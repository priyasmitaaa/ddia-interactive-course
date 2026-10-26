---
title: The Unix Philosophy — Composition, Uniform Interfaces and Experimentation
kind: lesson
minutes: 80
chapter: 10
objectives:
- State the four points of the 1978 Unix philosophy and relate them to modern practice
- Explain why a uniform interface (files and byte streams) enables composition, and its limits
- Explain separation of logic and wiring via stdin/stdout, and its limits
- Explain how immutable inputs and inspectable stages make Unix tools good for experimentation
reading:
- The Unix philosophy | 382-383
- A uniform interface | 383-384
- Separation of logic and wiring | 384-385
- Transparency and experimentation | 385-385
complete:
- Exercise 36 (external sort) is done
- You can name what Unix tools can't do that Hadoop can
- You answered the quiz
---

:::problem Why does a six-command pipeline beat a custom program?
Analyzing the log with a chain of commands was easy, and that's no coincidence. It was a key design idea of Unix, and it "remains astonishingly relevant today" (p. 382). Doug McIlroy, the inventor of Unix pipes, wrote in 1964: "We should have some ways of connecting programs like [a] garden hose — screw in another segment when it becomes necessary to massage data in another way."
:::

:::intuition Do one thing well, and expect to be composed
**The Unix philosophy** (1978, p. 382):
1. **Make each program do one thing well.** For a new job, build afresh rather than complicate old programs with new "features".
2. **Expect the output of every program to become the input to another, as yet unknown, program.** Don't clutter output with extraneous information. Avoid stringently columnar or binary input formats. Don't insist on interactive input.
3. **Design and build software to be tried early**, ideally within weeks. Don't hesitate to throw away clumsy parts and rebuild them.
4. **Use tools in preference to unskilled help** to lighten a programming task, even if you have to detour to build the tools.

Automation, rapid prototyping, incremental iteration, being friendly to experimentation, and breaking large projects into manageable chunks: it sounds remarkably like **Agile and DevOps** today. "Surprisingly little has changed in four decades."

`sort` is the model citizen. It's arguably a better sort than most languages' standard libraries, which don't spill to disk or use multiple threads. Yet it's barely useful alone. It becomes powerful in combination with `uniq`, and its implementers resisted the temptation to add uniq as a feature (pp. 382–383).

**What enables composition?**
- **A uniform interface** (pp. 383–384). In Unix, the interface is the **file** (file descriptor), just an **ordered sequence of bytes**. The same interface represents actual files, pipes, stdin and stdout, devices (`/dev/audio`) and TCP sockets. By convention many tools treat the bytes as **ASCII text with `\n` as the record separator** (arguably 0x1E, the ASCII record separator, would have been better). Field parsing is vaguer: whitespace, tabs, CSV and pipes all appear, and even xargs has half a dozen parsing options. (Footnote ii: URLs and HTTP are another uniform interface, and it's why you can link to anything on the web.)
- **Separation of logic and wiring** (p. 384). Programs read stdin and write stdout. The shell user decides where the input comes from and where the output goes. That's loose coupling, late binding or inversion of control. Pipes connect processes through a small in-memory buffer, without writing the whole intermediate stream to disk. Your own program can join a pipeline just by using stdin and stdout, for example an IP-to-country converter.
- **Transparency and experimentation** (p. 385). Inputs are treated as **immutable**, so you can rerun commands as often as you like. You can **end the pipeline at any point** and pipe into `less` to inspect it. You can write a stage's output to a file and restart later stages from it.
:::

:::visual PipelineViz | Ending the pipeline anywhere
This is the transparency point in practice. Click any stage to see its output, which is exactly what `... | less` gives you. Each stage is useful on its own and composable with the others.
:::

:::details The limits, and what comes next (pp. 384–385)
**The uniform interface isn't beautiful.** `{print $7}` is not very readable. Ideally it would be something like `{print $request_url}`, and the book returns to this idea later. Still, few pieces of software today compose as smoothly. "You can't easily pipe the contents of your email account and your online shopping history through a custom analysis tool, into a spreadsheet, and post the results to a social network or a wiki." Even databases with the same data model often don't make it easy to move data from one to another, which leads to **balkanization of data**.

**Limits of stdin/stdout.** Programs needing **multiple inputs or outputs** are possible but tricky. You can't pipe output into a network connection without a separate tool such as netcat or curl. (Footnote iii: BSD sockets deviated from "everything is a file", while Plan 9 and Inferno represent TCP connections as files in `/net/tcp`.) Once a program opens its own files or connections or starts subprocesses, it does its own wiring, and the shell's flexibility is reduced.

**The biggest limitation:** Unix tools run **on a single machine**, "and that's where tools like Hadoop come in" (p. 385).
:::

:::practice 36-external-sort | The pipeline, and sorting more than fits in memory
Build the external merge sort, `uniq -c` and top-k in Python, compare memory use with a hash table, then run the real shell pipeline on the same log.
:::

:::quiz
### mcq
Which is NOT one of the 1978 Unix philosophy points quoted in the book?
- [ ] Make each program do one thing well
- [ ] Expect the output of every program to become the input to another
- [ ] Design software to be tried early, and throw away clumsy parts
- [x] Use binary formats for efficiency between programs
>>>
The philosophy says to *avoid* stringently columnar or binary input formats (p. 382).

### mcq
What is Unix's uniform interface?
- [ ] JSON over HTTP
- [x] The file (descriptor): an ordered sequence of bytes, used for files, pipes, devices and sockets alike, conventionally as newline-separated ASCII text
- [ ] SQL
- [ ] Shared memory
>>>
That simplicity is what lets very different things plug together (p. 383).

### predict
You write a tool that reads stdin, converts IP addresses to country codes, and writes stdout. Can it be used in the middle of the log pipeline without changing the other tools?
- [ ] No, sort must be recompiled
- [x] Yes: it just reads stdin and writes stdout, and the shell wires it in
- [ ] Only if it's written in C
- [ ] Only at the end of the pipeline
>>>
That's separation of logic and wiring (p. 384).

### mcq
Why are Unix tools good for experimentation?
- [ ] They're fast to compile
- [x] Inputs are treated as immutable, any stage's output can be inspected, and stage outputs can be saved to restart later stages
- [ ] They have graphical interfaces
- [ ] They never fail
>>>
Transparency and experimentation (p. 385).

### tradeoff
What do you lose when a program opens its own input files and network connections instead of using stdin and stdout?
- [x] The flexibility of having the shell wire up inputs and outputs; the program does its own wiring, configurable perhaps by options but less composable
- [ ] Performance
- [ ] Correctness
- [ ] Nothing
>>>
Separation of logic and wiring is reduced (pp. 384–385).

### explain
"The sort tool is a great example of a program that does one thing well." Explain what that means and why it makes sort *more* useful, not less.
>>>
`sort` does only sorting, but does it extremely well: it handles larger-than-memory data by spilling to disk and uses multiple cores, arguably better than most languages' built-in sorts (p. 382). It doesn't try to also count, filter or format. Its implementers resisted adding uniq's job as a feature. Alone it's barely useful, but because it reads and writes the uniform interface (newline-separated text on stdin/stdout), it composes with uniq, awk, head and with programs that don't even exist yet. Combined with them it solves countless problems. Building that composability into every tool is what makes the whole toolbox powerful (pp. 382–383).
:::

:::connect Where this goes next
Tomorrow: the same philosophy distributed across thousands of machines. HDFS plays the role of the filesystem, and MapReduce is a "quirky" Unix process that always sorts between two user functions.
:::
