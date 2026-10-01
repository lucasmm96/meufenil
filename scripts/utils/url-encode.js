// scripts/url-encode.js
const input = process.argv[2];
if (!input) {
  console.error("Uso: node scripts/url-encode.js \"SENHA\"");
  process.exit(1);
}
console.log(encodeURIComponent(input));
