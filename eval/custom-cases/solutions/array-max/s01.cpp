#include <iostream>

int main() {
    int n;
    std::cin >> n;
    long long best = 0;
    for (int i = 0; i < n; i++) {
        long long x;
        std::cin >> x;
        if (i == 0 || x > best) best = x;
    }
    std::cout << best << "\n";
    return 0;
}
