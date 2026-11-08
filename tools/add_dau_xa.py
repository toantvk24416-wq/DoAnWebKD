# Thêm nhóm sản phẩm dầu xả / dưỡng tóc vào dữ liệu web (assets/js/data.js).
# Chạy:  python tools/add_dau_xa.py   rồi tăng SEED_VERSION trong assets/js/store.js
#
# Nguồn:
#   anh-goc/dau-xa/<Tên sản phẩm>/<ten>.jpg         ảnh sản phẩm (copy nguyên bản sang assets/img/products/dau-xa-<ten>.jpg)
#   anh-goc/dau-xa/<Tên sản phẩm>/<ten>_dagen.png   ảnh hover (tools/build_hover_images.py xử lý)
#   tools/dau_xa_davinesvietnam.json                tên, SKU, giá, mô tả lấy từ davinesvietnam.com (JSON-LD của trang sản phẩm)
# Sản phẩm không bán trên davinesvietnam.com (các màu ALCHEMIC, ALCHEMIC Creative, DEDE Leave-in, Authentic Moisturizing Balm)
# dùng giá TẠM (ghi chú "gia_tam") theo sản phẩm cùng dòng; quản trị viên sửa lại giá trong trang Quản trị > Sản phẩm.
# Chạy lại nhiều lần vẫn cho cùng kết quả: sản phẩm cũ cùng id được thay bằng bản mới.
import json, re, shutil, sys
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
SRC = WEB / "anh-goc" / "dau-xa"
IMG = WEB / "assets" / "img" / "products"
DATA_JS = WEB / "assets" / "js" / "data.js"
WEBINFO = json.load(open(WEB / "tools" / "dau_xa_davinesvietnam.json", encoding="utf-8"))
ADDED_ON = "2026-11-08"  # ngày lên kệ -> sản phẩm có nhãn NEW-IN

def web(keyword):
    """Các dung tích của một sản phẩm trên davinesvietnam.com, theo từ khóa trong đường dẫn."""
    rows = [r for r in WEBINFO if keyword in r["url"]]
    rows.sort(key=lambda r: r["size_ml"])
    return rows

def desc_of(rows):
    d = re.split(r"\s*\n|\s*\r", rows[0]["description"].strip())[0].strip()
    return d.rstrip(".")

# Dòng sản phẩm -> (bộ sưu tập, nhu cầu, loại tóc / da đầu)
LINE = {
    "ALCHEMIC": ("Alchemic", ["Giữ màu tóc nhuộm"], ["Tóc nhuộm"]),
    "DEDE": ("Essential Haircare", ["Làm mượt, giảm xơ"], ["Mọi loại tóc"]),
    "HEART OF GLASS": ("Heart of Glass", ["Giữ màu tóc nhuộm", "Phục hồi hư tổn"], ["Tóc nhuộm"]),
    "LOVE CURL": ("Essential Haircare", ["Làm mượt, giảm xơ"], ["Tóc xoăn"]),
    "LOVE SMOOTHING": ("Essential Haircare", ["Làm mượt, giảm xơ"], ["Tóc khô"]),
    "MELU": ("Essential Haircare", ["Phục hồi hư tổn"], ["Tóc hư tổn"]),
    "MINU": ("Essential Haircare", ["Giữ màu tóc nhuộm"], ["Tóc nhuộm"]),
    "MOMO": ("Essential Haircare", ["Dưỡng ẩm"], ["Tóc khô"]),
    "NOUNOU": ("Essential Haircare", ["Phục hồi hư tổn", "Dưỡng ẩm"], ["Tóc hư tổn"]),
    "NOURISHING": ("Naturaltech", ["Dưỡng ẩm", "Phục hồi hư tổn"], ["Tóc khô", "Da đầu khô"]),
    "OI": ("OI", ["Làm mượt, giảm xơ"], ["Mọi loại tóc"]),
    "RENEWING": ("Naturaltech", ["Chống lão hóa"], ["Mọi loại tóc"]),
    "REPLUMPING": ("Naturaltech", ["Dưỡng ẩm"], ["Tóc khô"]),
    "VOLU": ("Essential Haircare", ["Tạo phồng"], ["Tóc mỏng"]),
    "WELL BEING": ("Naturaltech", ["Dưỡng ẩm"], ["Mọi loại tóc"]),
    "AUTHENTIC": ("Authentic", ["Dưỡng ẩm"], ["Tóc khô", "Da đầu khô"]),
}

# (id, thư mục ảnh, tên hiển thị, loại, dòng, mô tả ngắn, từ khóa trên davinesvietnam.com hoặc None)
ITEMS = [
    ("dau-xa-dede", "DEDE Conditioner", "DEDE Dầu xả", "Dầu xả", "DEDE", "Dưỡng mềm nhẹ, dùng hằng ngày", "dede-conditioner"),
    ("dau-xa-momo", "MOMO Conditioner", "MOMO Dầu xả", "Dầu xả", "MOMO", "Cấp ẩm sâu cho tóc khô", "momo-conditioner"),
    ("dau-xa-nounou", "NOUNOU Conditioner", "NOUNOU Dầu xả", "Dầu xả", "NOUNOU", "Phục hồi tóc hư tổn do hóa chất", "nounou-conditioner"),
    ("dau-xa-minu", "MINU Conditioner", "MINU Dầu xả", "Dầu xả", "MINU", "Giữ màu và độ bóng cho tóc nhuộm", "dau-xa-minu"),
    ("dau-xa-melu", "MELU Conditioner", "MELU Dầu xả", "Dầu xả", "MELU", "Giảm chẻ ngọn cho tóc dài, yếu", "melu-conditioner"),
    ("dau-xa-love-smoothing", "LOVE SMOOTHING Conditioner", "LOVE SMOOTHING Dầu xả", "Dầu xả", "LOVE SMOOTHING", "Làm mượt, giảm rối xù", "love-smoothing-conditioner"),
    ("dau-xa-love-curl", "LOVE CURL Conditioner", "LOVE CURL Dầu xả", "Dầu xả", "LOVE CURL", "Tăng độ đàn hồi cho tóc xoăn", "love-curl-conditioner"),
    ("dau-xa-volu", "VOLU Conditioner", "VOLU Dầu xả", "Dầu xả", "VOLU", "Gỡ rối mà không làm nặng tóc mỏng", "volu-conditioner"),
    ("dau-xa-oi", "OI Conditioner", "OI Dầu xả", "Dầu xả", "OI", "Mềm, bóng, bảo vệ tóc khỏi nhiệt", "oi-conditioner"),
    ("dau-xa-heart-of-glass", "HEART OF GLASS Rich Conditioner", "HEART OF GLASS Dầu xả Rich", "Dầu xả", "HEART OF GLASS", "Nuôi dưỡng và làm bóng tóc vàng sáng", "heart-of-glass-rich-conditioner"),
    ("dau-xa-nourishing", "NOURISHING Vegetarian Miracle Conditioner", "NOURISHING Dầu xả Vegetarian Miracle", "Dầu xả", "NOURISHING", "Dưỡng ẩm cho tóc khô và da đầu khô", "nourishing-vegetarian-miracle"),
    ("dau-xa-renewing", "RENEWING Conditioning Treatment", "RENEWING Dầu xả Conditioning Treatment", "Dầu xả", "RENEWING", "Chống lão hóa cho tóc và da đầu", "renewing-conditioning-treatment"),
    ("dau-xa-replumping", "REPLUMPING Conditioner", "REPLUMPING Dầu xả", "Dầu xả", "REPLUMPING", "Gỡ rối, tăng đàn hồi cho tóc", "replumping-conditioner"),
    ("dau-xa-well-being", "WELLBEING Conditioner", "WELL BEING Dầu xả", "Dầu xả", "WELL BEING", "Gỡ rối, dưỡng ẩm nhẹ nhàng", "well-being-conditioner"),
    ("dau-xa-dede-leave-in", "DEDE Leave-in Conditioner", "DEDE Xịt dưỡng không xả", "Dưỡng tóc", "DEDE", "Gỡ rối, dưỡng mềm không cần xả", None),
    ("duong-authentic-moisturizing-balm", "Moisturizing Balm", "AUTHENTIC Kem dưỡng ẩm", "Dưỡng tóc", "AUTHENTIC", "Dưỡng ẩm cho tóc, da mặt và cơ thể", None),
]
ALCHEMIC_COLORS = [("chocolate", "Chocolate", "Socola"), ("copper", "Copper", "Đồng"), ("golden", "Golden", "Vàng"),
                   ("red", "Red", "Đỏ"), ("silver", "Silver", "Bạc"), ("tobacco", "Tobacco", "Nâu thuốc lá")]
CREATIVE_COLORS = [("coral", "Coral", "San hô"), ("lavender", "Lavender", "Oải hương"), ("marine-blue", "Marine Blue", "Xanh biển"),
                   ("pink", "Pink", "Hồng"), ("teal", "Teal", "Xanh mòng két")]
alc = web("alchemic-conditoner")  # 250 ml và 1000 ml (bản chung của dòng)
for slug, en, vi in ALCHEMIC_COLORS:
    ITEMS.append((f"dau-xa-alchemic-{slug}", f"ALCHEMIC Conditioner {en}", f"ALCHEMIC Dầu xả {en}", "Dầu xả", "ALCHEMIC",
                  f"Giữ và tăng sắc màu {vi.lower()} cho tóc nhuộm", ("alchemic", [("250 ml", alc[0]["price"]), ("1000 ml", alc[1]["price"])])))
for slug, en, vi in CREATIVE_COLORS:
    ITEMS.append((f"dau-xa-alchemic-creative-{slug}", f"ALCHEMIC Creative Conditioner {en}", f"ALCHEMIC Creative Dầu xả {en}", "Dầu xả", "ALCHEMIC",
                  f"Nhuộm màu {vi.lower()} tạm thời cho tóc sáng màu", ("alchemic", [("250 ml", alc[0]["price"])])))

TEMP_PRICE = {  # sản phẩm không có trên davinesvietnam.com: giá tạm theo sản phẩm cùng dòng
    "dau-xa-dede-leave-in": [("250 ml", web("dede-conditioner")[0]["price"])],
    "duong-authentic-moisturizing-balm": [("150 ml", 690000)],
}
TEMP_DESC = {
    "dau-xa-dede-leave-in": "Xịt dưỡng không xả dòng DEDE, gỡ rối và làm mềm tóc ngay sau khi gội, phù hợp mọi loại tóc",
    "duong-authentic-moisturizing-balm": "Kem dưỡng ẩm đa năng dòng Authentic, dùng cho tóc khô, da mặt và cơ thể, thành phần có nguồn gốc tự nhiên",
}

def find_files(folder):
    d = SRC / folder
    files = [f for f in d.iterdir() if f.is_file()]
    main = next(f for f in files if "dagen" not in f.name.lower())
    return main

def main():
    products = []
    for item in ITEMS:
        pid, folder, name, kind, line, short, source = item
        main_img = find_files(folder)
        dst = IMG / ("dau-xa-" + main_img.stem.rstrip(".") + main_img.suffix.lower())
        shutil.copyfile(main_img, dst)
        img = "assets/img/products/" + dst.name
        coll, needs, hair = LINE[line]
        if isinstance(source, str):  # có trên davinesvietnam.com
            rows = web(source)
            variants = [{"sku": r["sku"], "size": f"{r['size_ml']} ml", "price": r["price"], "stock": 30, "images": [img]} for r in rows]
            desc, url, temp = desc_of(rows), rows[-1]["url"], False
        else:
            sizes = source[1] if source else TEMP_PRICE[pid]
            code = re.sub(r"[^A-Z0-9]+", "-", pid.upper().replace("DAU-XA-", "").replace("DUONG-", ""))
            variants = [{"sku": f"DV-{code}-{s.split()[0]}", "size": s, "price": p, "stock": 30, "images": [img]} for s, p in sizes]
            desc = TEMP_DESC.get(pid) or f"{name} – dầu xả dòng Alchemic, {short[0].lower() + short[1:]}"
            url, temp = (alc[0]["url"] if source else None), True
        products.append({
            "id": pid, "name": name, "kind": kind, "line": line, "collection": coll, "needs": needs, "hair": hair,
            "short": short, "description": desc, "url": url, "variants": variants,
            "benefits": [short + ".", "Thành phần hoạt động tự nhiên."],
            "extra": "Dùng sau dầu gội cùng dòng để đạt hiệu quả tốt nhất." if kind == "Dầu xả" else "Không cần xả lại với nước.",
            "ingredients": None, "createdAt": ADDED_ON, **({"gia_tam": True} if temp else {}),
        })

    text = DATA_JS.read_text(encoding="utf-8")
    head, body = text.split("window.DAVINES_SEED = ", 1)
    seed = json.loads(body.strip().rstrip(";"))
    ids = {p["id"] for p in products}
    seed["products"] = [p for p in seed["products"] if p["id"] not in ids] + products
    # Dầu gội NOURISHING dành cho cả da đầu khô -> thêm vào nhóm lọc "Tình trạng da đầu"
    for p in seed["products"]:
        if p["id"] == "dau-goi-nourishing" and "Da đầu khô" not in p["hair"]:
            p["hair"].append("Da đầu khô")
    skus = [v["sku"] for p in seed["products"] for v in p["variants"]]
    dup = {s for s in skus if skus.count(s) > 1}
    if dup: sys.exit("Trùng SKU: " + ", ".join(sorted(dup)))
    DATA_JS.write_text(head + "window.DAVINES_SEED = " + json.dumps(seed, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8", newline="\n")
    print(f"Đã thêm {len(products)} sản phẩm, tổng {len(seed['products'])} sản phẩm.")
    print("Giá tạm:", ", ".join(p["name"] for p in products if p.get("gia_tam")))

if __name__ == "__main__":
    main()
