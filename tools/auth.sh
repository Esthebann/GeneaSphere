token() {
  curl -s -X POST http://localhost:3000/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"admin@genea.dev","password":"Password123!"}' \
  | jq -r '.token'
}
