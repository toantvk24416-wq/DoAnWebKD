"""Chuyển dữ liệu crawl (output/products.json + output/images) thành dữ liệu cho web.

Chạy lại mỗi khi crawl thêm sản phẩm:
    python website/tools/build_data.py
Kết quả:
    website/assets/js/data.js           (window.DAVINES_SEED)
    website/assets/img/products/*       (ảnh sản phẩm, copy từ output/images)
"""
import json
import re
import shutil
import unicodedata
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]  # thư mục web chứa server.js
# Thư mục dữ liệu crawl "output": tìm ngược lên từ thư mục web, vì web có thể bị chuyển vào thư mục con
ROOT = next(d for d in WEB.parents if (d / "output" / "products.json").exists())
SRC_JSON = ROOT / "output" / "products.json"
SRC_IMG = ROOT / "output" / "images"
OUT_JS = WEB / "assets" / "js" / "data.js"
OUT_IMG = WEB / "assets" / "img" / "products"
# Công dụng và thành phần lấy từ Davines (theo id sản phẩm); "source" ghi nguồn, không đưa lên web
CONTENT = WEB / "tools" / "davines_content.json"

# Dòng sản phẩm -> (bộ sưu tập, nhu cầu, loại tóc, mô tả ngắn)
LINES = {
    "dede":            ("Essential Haircare", ["Làm sạch nhẹ"], ["Mọi loại tóc"], "Làm sạch nhẹ nhàng, dùng hằng ngày"),
    "momo":            ("Essential Haircare", ["Dưỡng ẩm"], ["Tóc khô"], "Cấp ẩm cho tóc khô, thiếu ẩm"),
    "nounou":          ("Essential Haircare", ["Phục hồi hư tổn", "Dưỡng ẩm"], ["Tóc hư tổn"], "Nuôi dưỡng, phục hồi tóc hư tổn"),
    "minu":            ("Essential Haircare", ["Giữ màu tóc nhuộm"], ["Tóc nhuộm"], "Giữ màu và độ bóng cho tóc nhuộm"),
    "love smoothing":  ("Essential Haircare", ["Làm mượt, giảm xơ"], ["Tóc khô"], "Làm mượt, giảm xơ rối"),
    "love curl":       ("Essential Haircare", ["Làm mượt, giảm xơ"], ["Tóc xoăn"], "Tăng độ đàn hồi cho tóc xoăn, gợn sóng"),
    "volu":            ("Essential Haircare", ["Tạo phồng"], ["Tóc mỏng"], "Tạo độ phồng cho tóc mỏng, ít phồng"),
    "melu":            ("Essential Haircare", ["Phục hồi hư tổn"], ["Tóc hư tổn"], "Chống gãy rụng cho tóc dài, yếu"),
    "solu":            ("Essential Haircare", ["Làm sạch sâu"], ["Mọi loại tóc"], "Làm sạch sâu bụi bẩn và dư chất tạo kiểu"),
    "energizing":      ("Naturaltech", ["Chống rụng"], ["Da đầu yếu"], "Giảm gãy rụng, tăng sức sống cho chân tóc"),
    "purifying":       ("Naturaltech", ["Trị gàu"], ["Da đầu gàu"], "Làm sạch gàu, cân bằng da đầu"),
    "rebalancing":     ("Naturaltech", ["Làm sạch sâu"], ["Da đầu dầu"], "Kiểm soát dầu thừa trên da đầu"),
    "calming":         ("Naturaltech", ["Làm dịu da đầu"], ["Da đầu nhạy cảm"], "Làm dịu da đầu nhạy cảm"),
    "detoxifying":     ("Naturaltech", ["Làm sạch sâu"], ["Mọi loại tóc"], "Tẩy tế bào chết, thải độc da đầu"),
    "nourishing":      ("Naturaltech", ["Dưỡng ẩm"], ["Tóc khô"], "Nuôi dưỡng da đầu và tóc khô"),
    "renewing":        ("Naturaltech", ["Chống lão hóa"], ["Mọi loại tóc"], "Chống lão hóa cho da đầu và tóc"),
    "replumping":      ("Naturaltech", ["Dưỡng ẩm"], ["Tóc khô"], "Bổ sung độ ẩm, giúp tóc dày dặn"),
    "well being":      ("Naturaltech", ["Dưỡng ẩm"], ["Mọi loại tóc"], "Dưỡng ẩm nhẹ nhàng cho mọi loại tóc"),
    "oi":              ("OI", ["Làm mượt, giảm xơ"], ["Mọi loại tóc"], "Mang lại độ mềm, bóng và dễ vào nếp"),
    "alchemic":        ("Alchemic", ["Giữ màu tóc nhuộm"], ["Tóc nhuộm"], "Tăng cường sắc màu cho tóc nhuộm"),
    "heart of glass":  ("Heart of Glass", ["Giữ màu tóc nhuộm"], ["Tóc nhuộm"], "Dưỡng và bảo vệ tóc vàng, tóc tẩy"),
    "beautiful things":("Beautiful Things", ["Làm sạch sâu"], ["Mọi loại tóc"], "Loại bỏ khoáng chất và cặn bám trên tóc"),
    "prep":            ("Prep", ["Làm sạch nhẹ"], ["Mọi loại tóc"], "Chuẩn bị tóc trước khi tạo kiểu"),
}


def slugify(text):
    text = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def parse(item):
    name = item["name"]
    head = name.split(",")[0]
    if head.lower().startswith("combo"):
        return "combo-energizing-renewing", "Combo", "energizing", "Combo ENERGIZING Dầu gội + RENEWING Dầu xả", "100 ml + 60 ml"
    size = re.search(r"(\d+)\s*(ml|g)\b", head, re.I)
    size = f"{size.group(1)} {size.group(2).lower()}" if size else ""
    kind = "Bánh gội" if head.lower().startswith("bánh") else "Dầu gội"
    low = head.lower()
    line = next((k for k in sorted(LINES, key=len, reverse=True) if k in low), None)
    if line is None:
        raise ValueError(f"Không nhận ra dòng sản phẩm: {name}")
    return slugify(f"{kind}-{line}"), kind, line, None, size


def main():
    items = json.loads(SRC_JSON.read_text(encoding="utf-8"))
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    products = {}
    for it in items:
        pid, kind, line, combo_name, size = parse(it)
        collection, needs, hair, short = LINES[line]
        title = combo_name or f"{line.upper()} {kind}"
        p = products.setdefault(pid, {
            "id": pid,
            "name": title,
            "kind": kind,
            "line": line.upper(),
            "collection": collection,
            "needs": needs,
            "hair": hair,
            "short": short,
            "description": it["name"],
            "url": it["url"],
            "variants": [],
        })
        imgs = []
        for f in it["files"]:
            if (SRC_IMG / f).exists():
                shutil.copy2(SRC_IMG / f, OUT_IMG / f)
                imgs.append(f"assets/img/products/{f}")
        price = int(re.sub(r"\D", "", it["price"]))
        # Một số sản phẩm crawl không có SKU -> sinh mã dự phòng duy nhất để giỏ hàng không bị trùng
        sku = (it.get("sku") or "").strip() or f"DV-{re.sub(r'[^A-Z0-9]', '', line.upper())}-{re.sub(r'[^0-9]', '', size)}{'B' if kind == 'Bánh gội' else ''}"
        p["variants"].append({
            "sku": sku,
            "size": size,
            "price": price,
            "stock": 30 if it["in_stock"] else 0,
            "images": imgs,
        })
    content = json.loads(CONTENT.read_text(encoding="utf-8"))
    for p in products.values():
        p["variants"].sort(key=lambda v: int(re.sub(r"\D", "", v["size"]) or 0))
        p.update({k: v for k, v in content.get(p["id"], {}).items() if k != "source"})
    seed = {"products": sorted(products.values(), key=lambda p: (p["collection"], p["name"]))}
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JS.write_text(
        "// Sinh tự động bởi tools/build_data.py, không sửa tay.\n"
        "window.DAVINES_SEED = " + json.dumps(seed, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    n_var = sum(len(p["variants"]) for p in products.values())
    print(f"{len(products)} sản phẩm, {n_var} phiên bản -> {OUT_JS}")


if __name__ == "__main__":
    main()
