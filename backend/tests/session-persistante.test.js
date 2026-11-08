import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { makeTestApp } from './helpers/testApp.js'

const SECRET = 'test_jwt_secret_at_least_32_characters_long'

const cookieDe = (res) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('abflow_session='))
const valeur = (c) => c.split(';')[0]

describe('connexion persistante (cookie de session)', () => {
  let ctx, session

  before(async () => {
    ctx = await makeTestApp()
    const login = await request(ctx.app).post('/api/auth/login').send({ username: 'admin', password: 'testpass123' })
    session = login
  })
  after(() => ctx.cleanup())

  test('la connexion dépose un cookie httpOnly, SameSite=Strict, limité à /api/auth, d\'un an', () => {
    const c = cookieDe(session)
    assert.ok(c, 'cookie absent')
    assert.match(c, /HttpOnly/i)
    assert.match(c, /SameSite=Strict/i)
    assert.match(c, /Path=\/api\/auth/)
    const maxAge = Number(/Max-Age=(\d+)/i.exec(c)[1])
    assert.equal(maxAge, 365 * 24 * 3600)
  })

  test('le jeton d\'accès reste renvoyé dans la réponse (compatibilité)', () => {
    assert.ok(session.body.token)
  })

  test('refresh avec le cookie : nouveau jeton d\'accès de 24 h et cookie prolongé', async () => {
    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', valeur(cookieDe(session)))
    assert.equal(res.status, 200)
    const payload = jwt.verify(res.body.token, SECRET)
    assert.equal(payload.username, 'admin')
    assert.equal(payload.exp - payload.iat, 24 * 3600)
    assert.ok(cookieDe(res), 'le cookie doit être renouvelé')
    // le nouveau jeton fonctionne sur une route protégée
    const stats = await request(ctx.app).get('/api/stats').set('Authorization', `Bearer ${res.body.token}`)
    assert.equal(stats.status, 200)
  })

  test('refresh sans cookie : 401', async () => {
    const res = await request(ctx.app).post('/api/auth/refresh')
    assert.equal(res.status, 401)
  })

  test('refresh avec un cookie falsifié ou signé avec un autre secret : 401, cookie effacé', async () => {
    const faux = jwt.sign({ username: 'admin', typ: 'session' }, 'un_autre_secret_tres_long_et_different_12345')
    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', `abflow_session=${faux}`)
    assert.equal(res.status, 401)
    assert.match(cookieDe(res) ?? '', /abflow_session=;/)
  })

  test('refresh avec un simple jeton d\'accès dans le cookie : 401', async () => {
    const acces = jwt.sign({ username: 'admin' }, SECRET, { expiresIn: '24h' })
    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', `abflow_session=${acces}`)
    assert.equal(res.status, 401)
  })

  test('le jeton de session n\'est jamais accepté comme jeton d\'accès', async () => {
    const valeurSession = valeur(cookieDe(session)).split('=')[1]
    const res = await request(ctx.app).get('/api/stats').set('Authorization', `Bearer ${valeurSession}`)
    assert.equal(res.status, 401)
  })

  test('un cookie de session ne donne pas accès aux fichiers (il n\'est utile qu\'à /api/auth)', async () => {
    const res = await request(ctx.app).get('/api/stats').set('Cookie', valeur(cookieDe(session)))
    assert.equal(res.status, 401)
  })

  test('déconnexion : le cookie est effacé', async () => {
    const res = await request(ctx.app).post('/api/auth/logout')
    assert.equal(res.status, 204)
    assert.match(cookieDe(res), /abflow_session=;/)
  })
})

describe('connexion persistante : mot de passe changé', () => {
  test('une session ouverte avant le changement du mot de passe est refusée', async () => {
    const avant = await makeTestApp()
    const login = await request(avant.app).post('/api/auth/login').send({ username: 'admin', password: 'testpass123' })
    const cookie = valeur(cookieDe(login))
    avant.cleanup()

    const apres = await makeTestApp({ AUTH_PASSWORD: 'nouveau_mot_de_passe_456' })
    const res = await request(apres.app).post('/api/auth/refresh').set('Cookie', cookie)
    assert.equal(res.status, 401)
    apres.cleanup()
  })
})
