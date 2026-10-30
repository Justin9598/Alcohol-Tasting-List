# Alcohol Tasting List

A personal record of bottles drunk and bought: what it was, where it came from and what
it cost. Sake led, but it covers eleven categories now.

Published at https://justin9598.github.io/Alcohol-Tasting-List/

## Everything here is generated

Nothing in this repository is written by hand. It is built from a workbook kept in a
separate private repository, so **do not edit any of it**: the next build overwrites the
lot.

```
index.html      the shell: head, nav, and the seven screen containers
css/app.css     the whole stylesheet
js/tables.js    producers, shops, styles, grades, the questionnaire
js/basemap.js   Natural Earth coastlines, drawn under the map tiles
js/data.js      the ledger itself, one object per line
js/*.js         model, utilities, theme, flavour engine, navigation, boot
js/screens/     one file per tab
photos/         one WebP per bottle, fetched lazily
```

Every script and stylesheet is referenced with a `?v=` content hash, so an update is
picked up immediately rather than served from cache.
