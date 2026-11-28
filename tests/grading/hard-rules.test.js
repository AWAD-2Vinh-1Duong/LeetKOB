// Tests for syntax-aware hard rules (ban-list constraints), written before the code.
// A constraint starting "Do not use" or "Do not call", with every banned name in
// backticks, is decided by code. No test here names a dev-set problem or quotes dev-set code.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBanList,
  checkBanList,
  decideConstraint,
  partitionConstraints,
} from '../../src/modules/grading/service/hard-rules.js';

/** @param {string} source @param {string[]} names */
const check = (source, names) => checkBanList(source, names);

describe('parseBanList', () => {
  test('reads one banned name in backticks', () => {
    assert.deepEqual(parseBanList('Do not use `std::sort`.'), {
      names: ['std::sort'],
    });
  });

  test('reads several names and "Do not call"', () => {
    assert.deepEqual(
      parseBanList('Do not call `qsort` or `std::stable_sort`.'),
      { names: ['qsort', 'std::stable_sort'] },
    );
  });

  test('keeps a header name as written', () => {
    assert.deepEqual(parseBanList('Do not use `<algorithm>` at all.'), {
      names: ['<algorithm>'],
    });
  });

  test('returns null for a semantic constraint', () => {
    assert.equal(parseBanList('The merge step must be iterative.'), null);
  });

  test('returns null when no name is in backticks', () => {
    assert.equal(parseBanList('Do not use any library sort.'), null);
  });

  test('is case-sensitive on the opening words', () => {
    assert.equal(parseBanList('Please do not use `std::sort`.'), null);
  });
});

describe('checkBanList: violations', () => {
  test('qualified call is a violation with its line', () => {
    const src = 'int main() {\n  std::sort(v.begin(), v.end());\n}\n';
    const r = check(src, ['std::sort']);
    assert.equal(r.verdict, 'violation');
    assert.deepEqual(r.evidence, [
      { line: 2, text: 'std::sort(v.begin(), v.end());' },
    ]);
  });

  test('unqualified call counts when `using namespace std` is in scope', () => {
    const src =
      '#include <vector>\nusing namespace std;\nint main() {\n  sort(v.begin(), v.end());\n}\n';
    const r = check(src, ['std::sort']);
    assert.equal(r.verdict, 'violation');
    assert.equal(r.evidence[0].line, 4);
  });

  test('`using std::sort` then a bare call is a violation', () => {
    const src = 'using std::sort;\nvoid f() { sort(a, a + n); }\n';
    assert.equal(check(src, ['std::sort']).verdict, 'violation');
  });

  test('a plain C function name is found', () => {
    const src = 'void f() {\n  qsort(a, n, sizeof(int), cmp);\n}\n';
    assert.equal(check(src, ['qsort']).verdict, 'violation');
  });

  test('every use is reported, one evidence line each', () => {
    const src = 'std::sort(a, a + n);\nint x;\nstd::sort(b, b + m);\n';
    const r = check(src, ['std::sort']);
    assert.deepEqual(
      r.evidence.map((e) => e.line),
      [1, 3],
    );
  });

  test('line numbers stay right after a multi-line block comment', () => {
    const src = '/* a\n b\n c */\nstd::sort(a, a + n);\n';
    assert.equal(check(src, ['std::sort']).evidence[0].line, 4);
  });

  test('a banned header include is a violation when the header is banned', () => {
    const src = '#include <algorithm>\nint main() {}\n';
    const r = check(src, ['<algorithm>']);
    assert.equal(r.verdict, 'violation');
    assert.equal(r.evidence[0].line, 1);
  });

  test('one banned name among several is enough', () => {
    const src = 'std::stable_sort(a, a + n);\n';
    assert.equal(
      check(src, ['std::sort', 'std::stable_sort']).verdict,
      'violation',
    );
  });
});

describe('checkBanList: traps must not fire', () => {
  test('the banned name in a line comment', () => {
    const src = '// std::sort would be easier\nint main() {}\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('the banned name in a block comment', () => {
    const src = '/* do not call std::sort here */\nint main() {}\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('the banned name in a string literal', () => {
    const src = 'const char* s = "std::sort";\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('the banned name in a raw string literal', () => {
    const src = 'const char* s = R"x(std::sort(a, b))x";\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('a string with an escaped quote does not end early', () => {
    const src = 'const char* s = "say \\"hi\\" std::sort";\nint x;\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('a comment marker inside a string does not start a comment', () => {
    const src = 'const char* s = "// not a comment";\nstd::sort(a, b);\n';
    const r = check(src, ['std::sort']);
    assert.equal(r.verdict, 'violation');
    assert.equal(r.evidence[0].line, 2);
  });

  test("the student's own sort in a namespace of their own", () => {
    const src =
      'namespace mine {\nvoid sort(int* a, int n) { /* bubble */ }\n}\nint main() {\n  int a[3];\n  mine::sort(a, 3);\n}\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test("the student's own global sort, without `using namespace std`", () => {
    const src =
      'void sort(int* a, int n) {}\nint main() {\n  int a[3];\n  sort(a, 3);\n}\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test("the student's own sort in a namespace, with `using namespace std`", () => {
    const src =
      'using namespace std;\nnamespace mine {\n  void sort(int* a, int lo, int hi) {\n    if (hi - lo < 2) return;\n    sort(a, lo, (lo + hi) / 2);\n  }\n}\nint main() { int a[3]; mine::sort(a, 0, 3); }\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test("the student's own global function, with `using namespace std`", () => {
    const src =
      'using namespace std;\nlong long gcd(long long a, long long b) { return b ? gcd(b, a % b) : a; }\nint main() { return gcd(4, 6); }\n';
    assert.equal(check(src, ['std::gcd']).verdict, 'pass');
  });

  test("the student's own function declared before use, with `using namespace std`", () => {
    const src =
      'using namespace std;\nvoid sort(int* a, int n);\nint main() { int a[3]; sort(a, 3); }\nvoid sort(int* a, int n) {}\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('a qualified std::sort still counts next to an own sort', () => {
    const src =
      'using namespace std;\nvoid sort(int* a, int n) {}\nint main() {\n  vector<int> v;\n  std::sort(v.begin(), v.end());\n}\n';
    const r = check(src, ['std::sort']);
    assert.equal(r.verdict, 'violation');
    assert.deepEqual(
      r.evidence.map((e) => e.line),
      [5],
    );
  });

  test('a member function named sort', () => {
    const src = 'int main() {\n  std::list<int> l;\n  l.sort();\n}\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('a longer identifier that contains the name', () => {
    const src = 'void my_sort() {}\nint sorted = 0;\nstd::sort_heap(a, b);\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('<algorithm> included only for std::swap', () => {
    const src =
      '#include <algorithm>\nint main() {\n  int a = 1, b = 2;\n  std::swap(a, b);\n}\n';
    assert.equal(check(src, ['std::sort']).verdict, 'pass');
  });

  test('empty source passes', () => {
    assert.equal(check('', ['std::sort']).verdict, 'pass');
  });

  test('pass carries no evidence', () => {
    assert.deepEqual(check('int main() {}\n', ['std::sort']).evidence, []);
  });
});

describe('decideConstraint', () => {
  const ban = { id: 'c1', text: 'Do not use `std::sort`.' };
  const semantic = { id: 'c2', text: 'The merge step must be iterative.' };

  test('decides a ban-list constraint and says a hard rule did it', () => {
    const d = decideConstraint('std::sort(a, b);\n', ban);
    assert.ok(d);
    assert.equal(d.constraintId, 'c1');
    assert.equal(d.verdict, 'violation');
    assert.equal(d.decidedBy, 'hard-rule');
    assert.equal(d.evidence[0].line, 1);
  });

  test('a compliant solution passes the ban-list constraint', () => {
    const d = decideConstraint('int main() {}\n', ban);
    assert.ok(d);
    assert.equal(d.verdict, 'pass');
  });

  test('leaves a semantic constraint undecided', () => {
    assert.equal(decideConstraint('int main() {}\n', semantic), null);
  });

  test('a decision never carries a deduction', () => {
    const d = decideConstraint('std::sort(a, b);\n', {
      ...ban,
      deduction: 2,
    });
    assert.ok(d);
    assert.equal('deduction' in d, false);
  });
});

describe('partitionConstraints', () => {
  test('splits ban-list constraints from semantic ones, keeping order', () => {
    const cs = [
      { id: 'a', text: 'Do not use `std::sort`.' },
      { id: 'b', text: 'Recursion is not allowed in the merge step.' },
      { id: 'c', text: 'Do not call `qsort`.' },
    ];
    const { hard, semantic } = partitionConstraints(cs);
    assert.deepEqual(
      hard.map((c) => c.id),
      ['a', 'c'],
    );
    assert.deepEqual(
      semantic.map((c) => c.id),
      ['b'],
    );
  });

  test('a model stub is asked only about the semantic constraints', async () => {
    const cs = [
      { id: 'a', text: 'Do not use `std::sort`.' },
      { id: 'b', text: 'The merge step must be iterative.' },
    ];
    /** @type {string[][]} */
    const asked = [];
    const stub = async (/** @type {{ id: string }[]} */ list) => {
      asked.push(list.map((c) => c.id));
      return [];
    };
    const { semantic } = partitionConstraints(cs);
    await stub(semantic);
    assert.deepEqual(asked, [['b']]);
  });

  test('no semantic constraint means nothing is left for the model', () => {
    const { semantic } = partitionConstraints([
      { id: 'a', text: 'Do not use `std::sort`.' },
    ]);
    assert.deepEqual(semantic, []);
  });
});
