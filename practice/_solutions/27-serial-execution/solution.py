"""Reference solution for exercise 27. Run: python practice/_solutions/27-serial-execution/solution.py"""
import importlib.util
import pathlib
import queue
import threading
from concurrent.futures import Future

spec = importlib.util.spec_from_file_location(
    "serial", pathlib.Path(__file__).resolve().parents[2] / "27-serial-execution" / "serial.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class SerialExecutor:
    def __init__(self, state):
        self.state = state
        self.q: queue.Queue = queue.Queue()
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while True:
            proc, args, fut = self.q.get()
            try:
                fut.set_result(proc(self.state, *args))
            except BaseException as e:
                fut.set_exception(e)

    def submit(self, procedure, *args):
        fut = Future()
        self.q.put((procedure, args, fut))
        return fut


m.SerialExecutor = SerialExecutor
src = pathlib.Path(m.__file__).read_text(encoding="utf-8").split('if __name__ == "__main__":', 1)[1]
exec("if True:" + src, vars(m))
