# LTH Apps

Catalogo de apps y parches de LTH.OS. Permite actualizar apps sin publicar una
version nueva del sistema.

## Como funciona

- `catalogo.json` lista cada app con su version, el `sha256` de su archivo y el
  `minOs` que necesita. Va **firmado**: el OS no instala nada cuya firma o hash
  no cuadren.
- `apps/<id>/<id>.js` es el codigo de la app.
- `apps/<id>/app.json` declara nombre, version, minOs y notas del cambio.

## Publicar un cambio

1. Edita el `.js` de la app y sube su `version` en `app.json`.
2. Desde el repo del OS: `node scripts/lth-store-firmar.js construir`
3. Revisa: `node scripts/lth-store-firmar.js verificar`
4. Commit y push.

La llave privada de firma **nunca** entra a este repo.

## Que NO va aqui

`electron/main.js`, `preload.js` y todo el proceso principal. Ese codigo vive
dentro del ejecutable y solo cambia con una portable nueva. Si una app necesita
algo del sistema que aun no existe, se declara con `minOs` y el OS avisa en vez
de instalarla.
