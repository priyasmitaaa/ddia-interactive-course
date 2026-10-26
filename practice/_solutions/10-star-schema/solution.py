"""Reference solution for exercise 10. Run: python practice/_solutions/10-star-schema/solution.py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "warehouse", pathlib.Path(__file__).resolve().parents[2] / "10-star-schema" / "warehouse.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

m.EXAMPLE_3_1 = """
SELECT dim_date.weekday, dim_product.category, SUM(fact_sales.quantity) AS quantity_sold
FROM fact_sales
  JOIN dim_date    ON fact_sales.date_key   = dim_date.date_key
  JOIN dim_product ON fact_sales.product_sk = dim_product.product_sk
WHERE dim_date.year = 2013 AND dim_product.category IN ('Fresh fruit', 'Candy')
GROUP BY dim_date.weekday, dim_product.category
ORDER BY dim_product.category, quantity_sold DESC"""
m.HOLIDAY_REVENUE = """
SELECT s.city, d.is_holiday, ROUND(SUM(f.quantity * f.net_price), 2) AS revenue
FROM fact_sales f JOIN dim_date d ON f.date_key = d.date_key JOIN dim_store s ON f.store_sk = s.store_sk
GROUP BY s.city, d.is_holiday ORDER BY s.city, d.is_holiday"""
m.CREATE_AGGREGATE = """
CREATE TABLE daily_category_sales AS
SELECT f.date_key, p.category, SUM(f.quantity) AS quantity
FROM fact_sales f JOIN dim_product p ON f.product_sk = p.product_sk
GROUP BY f.date_key, p.category;"""
m.EXAMPLE_3_1_FROM_AGGREGATE = """
SELECT d.weekday, a.category, SUM(a.quantity) AS quantity_sold
FROM daily_category_sales a JOIN dim_date d ON a.date_key = d.date_key
WHERE d.year = 2013 AND a.category IN ('Fresh fruit', 'Candy')
GROUP BY d.weekday, a.category
ORDER BY a.category, quantity_sold DESC"""
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
