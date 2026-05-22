# antonovka.studio — тестовый сайт

Главная страница по макету Figma (архитектурное бюро).

- **Сайт:** https://ystas97.github.io/my-site/
- **Репозиторий:** https://github.com/ystas97/my-site

## Стек

HTML + CSS, шрифты Google Fonts (Raleway, Montserrat), **Supabase** (проекты и фото).

### Supabase

Инструкция: [supabase/README.md](supabase/README.md)  
Админка: [admin.html](admin.html) — настройка входа: [supabase/ADMIN.md](supabase/ADMIN.md)

```bash
cp js/supabase-config.example.js js/supabase-config.js
# вставьте URL и anon key
```

## Локальный просмотр

```bash
cd my-site
python3 -m http.server 8080
```

Откройте http://localhost:8080
