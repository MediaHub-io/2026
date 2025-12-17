# Guía de Contribución para MediaHub.io

¡Gracias por tu interés en contribuir a MediaHub.io! Tu ayuda es valiosa para mejorar la plataforma.

## ¿Cómo Contribuir?

Hay varias formas de contribuir al proyecto:

1.  **Reporte de Errores:** Si encuentras un error, por favor, abre un *issue* en el repositorio de GitHub. Incluye una descripción clara y concisa del problema, los pasos para reproducirlo y la versión del software.
2.  **Sugerencias de Características:** Si tienes una idea para una nueva característica, abre un *issue* para discutirla.
3.  **Envío de Código (Pull Requests):**
    *   Haz un *fork* del repositorio.
    *   Crea una nueva rama para tu característica o corrección de error (`git checkout -b feature/nombre-caracteristica` o `fix/nombre-error`).
    *   Realiza tus cambios y asegúrate de que el código pase las pruebas existentes.
    *   Haz *commit* de tus cambios con un mensaje claro y descriptivo (consulta la sección de Convenciones de Commits).
    *   Haz *push* a tu *fork* (`git push origin nombre-rama`).
    *   Abre un *Pull Request* (PR) contra la rama `main` del repositorio original.

## Convenciones de Commits

Utilizamos las convenciones de [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) para nuestros mensajes de *commit*. Esto facilita la generación automática de *changelogs*.

Ejemplos:

*   `feat: Añadir soporte para carga de videos`
*   `fix: Corregir error de desbordamiento en la barra de navegación`
*   `docs: Actualizar la guía de instalación`
*   `style: Formatear código con Prettier`

## Licencia

Al contribuir, aceptas que tus contribuciones serán licenciadas bajo la misma [Licencia](LICENSE) que el proyecto.
