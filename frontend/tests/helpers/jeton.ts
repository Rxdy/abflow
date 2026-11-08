// Un jeton d'accès factice mais bien formé (JWT non signé, valable une heure) : le frontend en lit la date
// d'expiration pour décider de le renouveler. `nom` le rend reconnaissable dans les assertions.
export function jeton(nom = 'test', valableSecondes = 3600): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ username: nom, exp: Math.floor(Date.now() / 1000) + valableSecondes })}.signature`
}
