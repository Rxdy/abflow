import { test, expect } from '@playwright/test'
import path from 'path'

// Identifiants de la stack e2e jetable — voir .env.e2e à la racine du repo.
const USERNAME = 'e2e'
const PASSWORD = 'e2e_test_password_123'

test('login -> upload -> apparaît dans la timeline -> suppression', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Identifiant').fill(USERNAME)
  await page.getByLabel('Mot de passe').fill(PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/files$/)

  await page.goto('/upload')
  await page.locator('input[type="file"]').setInputFiles(
    path.join(__dirname, 'fixtures', 'test-image.png'),
  )
  await page.getByRole('button', { name: /^Publier/ }).click()
  await expect(page.getByText('1 fichier publié !')).toBeVisible()

  await page.goto('/files')
  const cell = page.locator('.file-cell')
  await expect(cell).toHaveCount(1)

  await cell.locator('.cell-checkbox').click()
  await page.locator('.btn-delete-sel').click()
  await page.getByRole('button', { name: 'Supprimer' }).click()

  await expect(page.getByText('Aucun fichier.')).toBeVisible()
})
