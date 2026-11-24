#include <iostream>
using namespace std;

// std::max_element is banned, so this file has its own max
namespace mine {
    long long max(long long a, long long b) {
        return a > b ? a : b;
    }
}

int main() {
    int n;
    cin >> n;
    long long best;
    cin >> best;
    for (int i = 1; i < n; i++) {
        long long x;
        cin >> x;
        best = mine::max(best, x);
    }
    cout << best << "\n";
    return 0;
}
