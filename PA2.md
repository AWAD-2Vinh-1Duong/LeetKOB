# PA2 Submission

- Public Repository link: https://github.com/AWAD-2Vinh-1Duong/LeetKOB
- Branch protection: ![branch-protection](docs/tasks/PA2/assets/branch-protection.png)
- Required status check `quality` (bắt buộc CI xanh mới được merge vào `main`): ![required-status-check](docs/tasks/PA2/assets/required-status-check.png)
- Pull request bị CI đỏ chặn rồi chuyển xanh: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/6
  - Commit cố tình vi phạm lint: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/6/commits/8f8f01a2608d067000f38ec0b44cf0e054e994ab
  - CI run đỏ: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41222159341
  - Commit làm PR xanh trở lại: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/6/commits/e04ff6f349e07bf7cfe1b6658e7caabfc289cc1e
  - CI run xanh: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41222245456
- CI run cho tag `pa2`: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions?query=branch%3Apa2 (run trên cùng là run của commit đang gắn tag; file này nằm trong chính commit đó nên không thể ghi sẵn số run)
- Deliberate contract break (PR): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/8
  - Commit vi phạm contract (bỏ idempotency lookup): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/8/commits/fb6e601019dee79c7a768e11c19a6fb030114ba6
  - CI run đỏ (3 test idempotency fail): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41383050327
  - Commit sửa lại cho đúng contract (không sửa test): https://github.com/AWAD-2Vinh-1Duong/LeetKOB/pull/8/commits/d7d4c9211c4e34fa82f98f56db49aa58c70833fd
  - CI run xanh trở lại: https://github.com/AWAD-2Vinh-1Duong/LeetKOB/actions/runs/41383117774
