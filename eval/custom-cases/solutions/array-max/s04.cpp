#include <algorithm>
#include <iostream>
#include <vector>

long long find_max(std::vector<long long> v) {
    std::sort(v.begin(), v.end());
    return v.back();
}

int main() {
    int n;
    std::cin >> n;
    std::vector<long long> a(n);
    for (auto& x : a) std::cin >> x;
    std::cout << find_max(a) << "\n";
    return 0;
}
