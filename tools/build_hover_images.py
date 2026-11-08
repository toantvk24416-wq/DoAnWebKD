# Tạo ảnh hover (ảnh gen) cho thẻ sản phẩm và trang chi tiết.
# Chạy lại mỗi khi thêm ảnh vào các thư mục ảnh gen:  python tools/build_hover_images.py
# Ảnh gốc + ảnh gen nằm trong thư mục anh-goc/: dau-goi/<TÊN>/<dung tích>/, banh-goi/<TÊN>/, combo/<dung tích>/, dau-xa/<Tên sản phẩm>/
#
# Cách ghép: trong mỗi thư mục con, file  TEN_<dung tích>[_2].ext  là ảnh gốc,
# file  TEN_da gen_<dung tích>[_2].ext  (hoặc  ten_dagen.ext  ở thư mục dau-xa) là ảnh gen của nó. Ảnh gốc được so nội dung (md5)
# với ảnh trong assets/img/products để biết đó là ảnh của sản phẩm / dung tích nào.
# Ảnh gen được thu nhỏ, lưu JPG vào assets/img/products-gen, rồi ghi bảng tra cứu
# assets/js/hover-images.js. Dung tích không có ảnh gen thì giữ ảnh gốc khi hover.
import csv, hashlib, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Thư mục chứa ảnh gốc + ảnh gen (không phục vụ trên web, chỉ là đầu vào của script này)
SRC = os.path.join(ROOT, "anh-goc")
PRODUCTS = os.path.join(ROOT, "assets", "img", "products")
OUT = os.path.join(ROOT, "assets", "img", "products-gen")
JS = os.path.join(ROOT, "assets", "js", "hover-images.js")
MAX_SIDE = 900

# Thư mục sản phẩm có tên khác mã sản phẩm (chỉ cần khi thư mục không có ảnh gốc để so)
FOLDER_ID = {
    "BEAUTIFUL-THINGS-CHELATING": "dau-goi-beautiful-things",
    "DETOXIFYING-SCRUB": "dau-goi-detoxifying",
    "HEART-OF-GLASS-SILKENING": "dau-goi-heart-of-glass",
}

def md5(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def norm_size(s):
    return re.sub(r"\s+", "", s).lower()

def main():
    by_hash = {md5(os.path.join(PRODUCTS, n)): "assets/img/products/" + n for n in os.listdir(PRODUCTS)}
    with open(os.path.join(ROOT, "data", "product_variants.csv"), encoding="utf-8-sig") as f:
        variants = list(csv.DictReader(f))
    # Sản phẩm mới trong data.js chưa được web ghi xuống CSV thì lấy dung tích từ data.js
    with open(os.path.join(ROOT, "assets", "js", "data.js"), encoding="utf-8") as f:
        seed = json.loads(f.read().split("window.DAVINES_SEED = ", 1)[1].strip().rstrip(";"))
    have = {(v["productId"], v["sku"]) for v in variants}
    for p in seed["products"]:
        for v in p["variants"]:
            if (p["id"], v["sku"]) not in have:
                variants.append({"productId": p["id"], "sku": v["sku"], "size": v["size"], "images": "|".join(v["images"])})
    for v in variants:
        v["imgs"] = [x for x in v["images"].split("|") if x]

    os.makedirs(OUT, exist_ok=True)
    by_image, by_variant, missing = {}, {}, []

    walk = sorted(os.walk(SRC))
    for folder, _, files in walk:
        gens = [n for n in files if "_da gen_" in n or "_dagen" in n]
        for g in sorted(gens):
            orig_stem = os.path.splitext(g.replace("_da gen_", "_"))[0] if "_da gen_" in g else os.path.splitext(g)[0].replace("_dagen", "").rstrip(".")
            orig = next((n for n in files if "_da gen_" not in n and os.path.splitext(n)[0] == orig_stem), None)
            src_img = by_hash.get(md5(os.path.join(folder, orig))) if orig else None
            if src_img:
                name = os.path.splitext(os.path.basename(src_img))[0] + ".jpg"
                owners = [v for v in variants if src_img in v["imgs"]]
            else:
                # Không có ảnh gốc cùng thư mục: đoán theo tên thư mục sản phẩm + dung tích trong tên file
                m = re.search(r"_da gen_(\d+(?:ml|g))", g)
                parts = os.path.relpath(folder, ROOT).split(os.sep)
                pid = next((FOLDER_ID[x] for x in parts if x in FOLDER_ID), "")
                owners = [v for v in variants if v["productId"] == pid and m and norm_size(v["size"]) == m.group(1)]
                if not owners:
                    missing.append(os.path.relpath(os.path.join(folder, g), ROOT)); continue
                name = f"{owners[0]['productId']}-{m.group(1)}.jpg"
            im = Image.open(os.path.join(folder, g)).convert("RGB")
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            im.save(os.path.join(OUT, name), "JPEG", quality=82, optimize=True, progressive=True)
            gen = "assets/img/products-gen/" + name
            if src_img:
                by_image[src_img] = gen
            for v in owners:
                key = v["productId"] + "|" + v["size"]
                # Ưu tiên ảnh gen của ảnh đầu tiên (ảnh hiện trên thẻ sản phẩm)
                cur = by_variant.get(key)
                rank = v["imgs"].index(src_img) if src_img in v["imgs"] else 0
                if cur is None or rank < cur[0]:
                    by_variant[key] = (rank, gen)

    data = {"byImage": dict(sorted(by_image.items())),
            "byVariant": {k: by_variant[k][1] for k in sorted(by_variant)}}
    with open(JS, "w", encoding="utf-8") as f:
        f.write("// Sinh tự động bằng tools/build_hover_images.py từ các thư mục ảnh gen. Không sửa tay.\n")
        f.write("// byImage: ảnh gốc -> ảnh gen của chính ảnh đó; byVariant: \"mã sản phẩm|dung tích\" -> ảnh gen hiện khi hover.\n")
        f.write("window.HOVER_IMAGES = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")

    no_gen = [v["productId"] + " " + v["size"] for v in variants if v["productId"] + "|" + v["size"] not in by_variant]
    print(f"Đã tạo {len(os.listdir(OUT))} ảnh gen, {len(by_variant)}/{len(variants)} dung tích có ảnh hover.")
    if no_gen: print("Giữ ảnh gốc (chưa có ảnh gen):", ", ".join(no_gen))
    if missing: print("Không ghép được:", ", ".join(missing))

if __name__ == "__main__":
    sys.exit(main())
