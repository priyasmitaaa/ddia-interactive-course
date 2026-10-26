"""Reference solution for exercise 09. Run: python practice/_solutions/09-sqlite-indexes/solution.py"""
import importlib.util
import pathlib

spec = importlib.util.spec_from_file_location(
    "indexes", pathlib.Path(__file__).resolve().parents[2] / "09-sqlite-indexes" / "indexes.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
m.CREATE_EMAIL_INDEX = "CREATE INDEX idx_email ON users(email)"
m.CREATE_NAME_INDEX = "CREATE INDEX idx_name ON users(last_name, first_name)"
m.CREATE_COVERING_INDEX = "CREATE INDEX idx_last_city ON users(last_name, city)"
m.CREATE_DATE_INDEX = "CREATE INDEX idx_signup ON users(signup_date)"
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
