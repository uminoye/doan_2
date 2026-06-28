{
  "root": true,
  "env": { "browser": true, "es2020": true },
  "extends": ["eslint:recommended"],
  "ignorePatterns": ["dist", ".eslintrc.cjs"],
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },
  "rules": {
    "no-unused-vars": "warn",
    "no-undef": "warn",
    "no-empty": "warn",
    "no-prototype-builtins": "off",
    "no-useless-escape": "warn"
  }
}