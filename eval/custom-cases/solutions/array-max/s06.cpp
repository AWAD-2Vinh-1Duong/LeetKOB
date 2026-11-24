#include <cstdio>

static long long best_of(int left, long long best) {
    if (left == 0) return best;
    long long x;
    std::scanf("%lld", &x);
    return best_of(left - 1, x > best ? x : best);
}

int main() {
    int n;
    long long first;
    std::scanf("%d %lld", &n, &first);
    std::printf("%lld\n", best_of(n - 1, first));
    return 0;
}
