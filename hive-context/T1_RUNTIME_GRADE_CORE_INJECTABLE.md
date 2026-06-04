# T1: RUNTIME GRADE CORE INJECTABLE

## THE 10 PRINCIPLES (P1-P10) — Copy-paste into thought stream
P1 DEFENSIVE IMPORT — import * as X; if(typeof X.fn!=='function') throw
P2 TYPE CERTAINTY — validate at boundaries: if(!data||typeof data!=='object') throw
P3 ERROR COMPLETENESS — catch(e){log+recover} or catch(e){log+propagate}. NEVER catch{}
P4 RESOURCE LIFECYCLE — setInterval->clearInterval in finally. open->close. add->remove
P5 ATOMIC STATE — const prev={...state}; try{state={...new}} catch{state=prev}
P6 DEPENDENCY CHECK — if(typeof fs?.readFileSync!=='function') throw before using
P7 PATH RESOLUTION — path.join(os.homedir(),'.config','app','config.json'). NEVER /home/
P8 CONFIG VALIDATION — if(typeof port!=='number'||port<1||port>65535) throw
P9 ASYNC DISCIPLINE — await in try/catch OR .catch(). NEVER fire-and-forget
P10 OUTPUT CONTRACT — return type accurate in ALL paths. string|Error not just string

## BUILD ORDER (Error FIRST, Happy SECOND)
1. [P2] Validate inputs: type, null, range. Fail fast.
2. [P6] Verify dependencies: check APIs exist before calling.
3. [P3] Handle errors: catch(log+recover) or catch(log+propagate).
4. [P4] Cleanup resources: try/finally for intervals, files, connections.
5. [P5] Atomic state: capture previous, single atomic assignment, restore on error.
6. [P7] Path resolution: path.join, os.homedir, process.cwd. No hardcoded paths.
7. [P9] Async handling: await in try/catch or .catch() chain.
8. [P10] Output contract: return documented type in ALL code paths.
9. [P1] Evidence: writeFileSync evidence record before returning success.

## THE 7 QUESTIONS (Before writing ANY function)
Q1 Return type: What does this return? Correct in ALL paths?
Q2 Null safety: What if input is null/undefined/wrong type?
Q3 Error paths: What if file doesn't exist/network down/API fails?
Q4 Resource cleanup: Cleaned up in error paths?
Q5 Concurrent safety: Works when called twice concurrently?
Q6 Race conditions: Any race in state management?
Q7 Environment: Break on different OS/path/container?

## THE 6 GATES
PLAN — requirements documented, error strategy defined, deps identified
BUILD — error FIRST, happy SECOND, no catch{}, no as without validation
TEST — 0 critical/high findings, spec fidelity, no theatrical patterns
VERIFY — container test 90%+, triple evidence, all systems operational
AUDIT — spec comparison, resource leak check, type safety audit, path audit
DELIVERY — container evidence, ship package, NOTHING clipped/truncated

## FAILURE-MODE-FIRST TEMPLATE
export function doSomething(input: unknown): Result<Output> {
  if(typeof input!=='string'||input.length===0) return {success:false,error:'Invalid input',evidence:mkEv()};
  if(typeof fs?.readFileSync!=='function') throw new Error('[P6] fs unavailable');
  const timeout=config.timeout; if(typeof timeout!=='number'||timeout<0) throw new Error('[P8] Invalid timeout');
  try {
    const p=path.join(os.homedir(),'.cache','app',input);
    const interval=setInterval(()=>ping(),5000);
    try { const data=fs.readFileSync(p,'utf-8'); const result=process(data);
      return {success:true,data:result,evidence:mkEv(input,result)}; }
    finally { clearInterval(interval); }
  } catch(e) {
    const msg=e instanceof Error?e.message:String(e);
    fs.appendFileSync('/tmp/errors.log',`${new Date().toISOString()} doSomething: ${msg}\n`);
    return {success:false,error:msg,evidence:mkEv(input,null)};
  }
}

## CRITICAL ANTI-PATTERNS
[P3] catch{} — error silently swallowed. ALWAYS log+recover or log+propagate.
[P2] data as Type — type erased at runtime. ALWAYS validate before cast.
[P4] setInterval(fn,100) without clearInterval — leaks forever. Use try/finally.
[P9] someAsync().then(fn) without .catch — unhandled rejection crashes process.
[P5] state.x=true; await f(); state.x=false — torn state if f throws.
[P7] '/home/user/config.json' — only works on one machine. Use path.join.
[P10] function get():string{catch{return null}} — null is not string.
[P1] import {x} from './y' without verifying — crashes if missing.
[P6] fs.readFileSync(p) without checking fs exists — crashes if unavailable.
[P8] config.port used without validation — NaN crashes the server.

## THE ENGINEER'S OATH
I engineer software, not write code.
My output works in runtime, not just in theory.
I handle errors in ALL paths, not just the happy path.
I validate types at boundaries, never trust assumptions.
I clean up resources in ALL paths, not just when things go well.
I match the spec EXACTLY, nothing clipped or simplified.
I verify mechanically, not by self-claim.
I ship what works. Anything less is a defect.

## KEY NPM PACKAGES
xstate (state machines), wink-nlp (NLP), better-sqlite3 (persistence),
p-queue (queues), bottleneck (rate limit), opossum (circuit breaker),
fast-check (property tests), peggy (PEG parsing), ts-morph (compiler API),
zod (validation), stryker (mutation testing)