# Publicar la app (Vercel + Neon, gratis)

La app se publica en **Vercel** (plan Hobby: proyectos personales y no comerciales) y la base de datos vive en **Neon**
(plan gratis, PostgreSQL + PostGIS). La base pesa ~50 MB; el límite gratis de Neon es 0,5 GB.

## 1. Base de datos en Neon
1. Entrar a <https://neon.tech> con la cuenta de GitHub.
2. **Create project** → nombre `mapa-riesgo`, PostgreSQL 17, región **AWS South America East 1 (São Paulo)** (la más cercana a Perú).
3. En **Connect** copiar dos direcciones:
   - **Directa** (el host no dice `-pooler`): para cargar los datos desde la computadora.
   - **Agrupada / pooled** (el host dice `-pooler`): para Vercel.

## 2. Cargar los datos (desde la carpeta del proyecto)
```bash
DATABASE_URL="postgresql://…DIRECTA…?sslmode=require" npm run db:migrate
DATABASE_URL="postgresql://…DIRECTA…?sslmode=require" npm run db:cargar
```
La variable del comando tiene prioridad sobre `.env` (que sigue apuntando a la base local).
Los cálculos pesados (pendiente, caminos aguas abajo) ya están en `data/processed/`; no se necesita Docker.

## 3. App en Vercel
1. Subir los cambios a GitHub (`git push`).
2. Entrar a <https://vercel.com> con la cuenta de GitHub → **Add New → Project** → importar el repositorio.
3. **Environment Variables** (para Production, Preview y Development):
   - `DATABASE_URL` = la dirección **agrupada** (pooled) de Neon.
   - `NEXT_PUBLIC_SITE_URL` = la dirección pública, p. ej. `https://mapa-riesgo.vercel.app` (si aún no se conoce, poner
     una provisional y volver a desplegar después).
4. **Deploy**. Las funciones corren en São Paulo (`vercel.json`, región `gru1`), junto a la base.

## 4. Comprobar
```bash
E2E_URL="https://…vercel.app" npm run test:e2e
```

## Notas
- La app no tiene usuarios ni guarda datos de nadie: solo muestra información pública. El aviso "Versión de prueba"
  aparece en la cabecera.
- Para actualizar los datos: cambiar `data/`, `npm run datos:todo` en local y repetir el paso 2 contra Neon.
- Neon suspende la base tras unos minutos sin uso; la primera consulta después tarda 1–2 s más.
