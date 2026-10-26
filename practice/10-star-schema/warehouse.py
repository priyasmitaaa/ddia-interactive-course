"""
Exercise 10 — A tiny data warehouse: star schema, analytic queries, materialized aggregates
(book pp. 87-93, 98-100).

Run:  python practice/10-star-schema/warehouse.py
"""
import datetime as dt
import random
import sqlite3
import time

rand = random.Random(10)
db = sqlite3.connect(":memory:")

# ---------------------------------------------------------------------------
# The star schema of Figure 3-9 (simplified): one fact table + dimension tables.
# ---------------------------------------------------------------------------
db.executescript("""
CREATE TABLE dim_date    (date_key INTEGER PRIMARY KEY, year INT, month INT, day INT, weekday TEXT, is_holiday INT);
CREATE TABLE dim_product (product_sk INTEGER PRIMARY KEY, sku TEXT, description TEXT, brand TEXT, category TEXT);
CREATE TABLE dim_store   (store_sk INTEGER PRIMARY KEY, state TEXT, city TEXT);
CREATE TABLE fact_sales  (date_key INT REFERENCES dim_date, product_sk INT REFERENCES dim_product,
                          store_sk INT REFERENCES dim_store, quantity INT, net_price REAL);
""")

HOLIDAYS = {(1, 1), (7, 4), (12, 25), (11, 28)}
day = dt.date(2013, 1, 1)
dates = []
while day <= dt.date(2014, 12, 31):
    key = int(day.strftime("%y%m%d"))
    dates.append(key)
    db.execute("INSERT INTO dim_date VALUES (?,?,?,?,?,?)",
               (key, day.year, day.month, day.day, day.strftime("%a"), int((day.month, day.day) in HOLIDAYS)))
    day += dt.timedelta(days=1)

CATS = {"Fresh fruit": ["Bananas", "Apples", "Mango"], "Candy": ["Chocolate bar", "Gummy bears"],
        "Bakery": ["Croissant", "Bagel"], "Pet supplies": ["Fish food", "Cat litter"]}
BRANDS = ["Freshmax", "Dealicious", "Aquatech", "Sweetco"]
products = []
for cat, items in CATS.items():
    for it in items:
        for b in BRANDS[:2]:
            sk = 30 + len(products)
            products.append((sk, cat))
            db.execute("INSERT INTO dim_product VALUES (?,?,?,?,?)", (sk, f"SKU{sk}", it, b, cat))
for sk, (st, city) in enumerate([("WA", "Seattle"), ("CA", "San Francisco"), ("CA", "Palo Alto"), ("NY", "New York")], 1):
    db.execute("INSERT INTO dim_store VALUES (?,?,?)", (sk, st, city))


def fake_sales(n):
    for _ in range(n):
        d = rand.choice(dates)
        sk, cat = rand.choice(products)
        weekend = dt.datetime.strptime(str(d), "%y%m%d").weekday() >= 5
        qty = rand.randint(1, 4) + (2 if weekend and cat == "Candy" else 0)
        yield (d, sk, rand.randint(1, 4), qty, round(rand.uniform(0.5, 20), 2))


db.executemany("INSERT INTO fact_sales VALUES (?,?,?,?,?)", fake_sales(300_000))
db.commit()


def run(label, sql):
    t = time.perf_counter()
    rows = db.execute(sql).fetchall()
    ms = (time.perf_counter() - t) * 1000
    print(f"\n{label}  ({len(rows)} rows, {ms:.1f} ms)")
    for r in rows[:14]:
        print("   ", r)
    return rows


# ---------------------------------------------------------------------------
# TASK 1: Example 3-1. Are people more inclined to buy fresh fruit or candy depending on the
# day of the week? Weekday, category, total quantity, for 2013 only, categories Fresh fruit/Candy.
# ---------------------------------------------------------------------------
EXAMPLE_3_1 = "TODO"

# ---------------------------------------------------------------------------
# TASK 2: one more question an analyst might ask: total revenue (quantity * net_price)
# per store city on holidays vs non-holidays.
# ---------------------------------------------------------------------------
HOLIDAY_REVENUE = "TODO"

# ---------------------------------------------------------------------------
# TASK 3: a materialized aggregate. Create a table daily_category_sales(date_key, category,
# quantity) holding SUM(quantity) per day and category, then re-answer Task 1 from it.
# Compare the timings. What question can the aggregate NOT answer any more?
# ---------------------------------------------------------------------------
CREATE_AGGREGATE = "TODO"
EXAMPLE_3_1_FROM_AGGREGATE = "TODO"


if __name__ == "__main__":
    print(f"fact_sales: {db.execute('SELECT count(*) FROM fact_sales').fetchone()[0]:,} rows; "
          f"dim_date: {len(dates)} rows; dim_product: {len(products)} rows")
    a = b = None
    if EXAMPLE_3_1 != "TODO":
        a = run("Task 1 - Example 3-1 on the raw fact table", EXAMPLE_3_1)
    if HOLIDAY_REVENUE != "TODO":
        run("Task 2 - revenue per city, holiday vs not", HOLIDAY_REVENUE)
    if CREATE_AGGREGATE != "TODO":
        t = time.perf_counter()
        db.executescript(CREATE_AGGREGATE)
        print(f"\nTask 3 - built aggregate in {(time.perf_counter() - t) * 1000:.0f} ms, "
              f"{db.execute('SELECT count(*) FROM daily_category_sales').fetchone()[0]:,} rows")
        if EXAMPLE_3_1_FROM_AGGREGATE != "TODO":
            b = run("Task 3 - Example 3-1 from the aggregate", EXAMPLE_3_1_FROM_AGGREGATE)
            if a is not None:
                print("\n    same answer as Task 1:", sorted(a) == sorted(b))
    if a is None:
        print("\nTask 1 not done yet: fill in EXAMPLE_3_1")
