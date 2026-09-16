# Premium de tester

Este permiso es independiente de `users/{uid}.isPremium` (Premium comprado). Solo se
administra desde Firebase Console o con el Admin SDK; la aplicación no puede escribirlo.

## Conceder a un UID

En Firestore, crear el documento `testerPremium/{UID}` con:

- `active`: `true` (boolean)
- `grantedAt`: fecha y hora (timestamp)
- `grantedBy`: identificador del administrador (string, recomendado)

El acceso permanece activo sin fecha de caducidad hasta que se retire manualmente.

## Retirar

Editar el mismo documento y guardar:

- `active`: `false`
- `revokedAt`: fecha y hora (timestamp)
- `revokedBy`: identificador del administrador (string, recomendado)

No es necesario borrar el documento: conservarlo mantiene el registro de cuándo se concedió
y retiró. La app escucha el cambio y deja de considerar Premium al usuario. Una copia local
en caché nunca puede reactivar el permiso.
