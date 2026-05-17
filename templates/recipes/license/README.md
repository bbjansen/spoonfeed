# License Templates

License file templates for generated projects. The CLI prompts for license selection during scaffolding.

## Links

- [Choose a License](https://choosealicense.com/)
- [SPDX License List](https://spdx.org/licenses/)
- [Open Source Initiative](https://opensource.org/licenses)
- [GNU Licenses](https://www.gnu.org/licenses/)

## Available Licenses

| License                          | File                 | SPDX ID                 | Type             |
| -------------------------------- | -------------------- | ----------------------- | ---------------- |
| MIT                              | `LICENSE.mit`        | `MIT`                   | Permissive       |
| Apache 2.0                       | `LICENSE.apache`     | `Apache-2.0`            | Permissive       |
| ISC                              | `LICENSE.isc`        | `ISC`                   | Permissive       |
| BSD 3-Clause                     | `LICENSE.bsd3`       | `BSD-3-Clause`          | Permissive       |
| Mozilla Public License 2.0       | `LICENSE.mpl2`       | `MPL-2.0`               | Weak copyleft    |
| GNU GPL v3                       | `LICENSE.gpl3`       | `GPL-3.0-only`          | Strong copyleft  |
| GNU AGPL v3                      | `LICENSE.agpl3`      | `AGPL-3.0-only`         | Network copyleft |
| Proprietary           | `LICENSE.proprietary` | `LicenseRef-Proprietary` | Proprietary      |
| Unlicensed (All Rights Reserved) | `LICENSE.unlicensed` | `UNLICENSED`            | Proprietary      |

## Usage

The selected license is copied to your project root as `LICENSE`:

```bash
# Example: MIT
cp LICENSE.mit LICENSE
```

Replace `[year]` and `[fullname]` placeholders with your values.

## When to Use Each

| Use Case                                   | Recommended License    |
| ------------------------------------------ | ---------------------- |
| Open source library (max adoption)         | MIT or ISC             |
| Open source with patent protection         | Apache 2.0             |
| Open source, file-level copyleft           | MPL 2.0                |
| Open source, full copyleft                 | GPL v3                 |
| SaaS/network service, force source sharing | AGPL v3                |
| Internal proprietary projects               | Proprietary |
| Client projects (no open source)           | Unlicensed             |

## Generated Files

| File      | Description               |
| --------- | ------------------------- |
| `LICENSE` | The selected license text |
