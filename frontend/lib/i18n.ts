export type Lang = 'en' | 'ru';

export const dictionary = {
  en: {
    title: "AVA Studio",
    create: "Create Job",
    generating: "Generating...",
    history: "History",
    login: "Login with Google",
    themes: { light: "Light", dark: "Dark", cyber: "Cyber" },
    status: { CREATED: "Queued", RUNNING: "Processing", COMPLETED: "Done", FAILED: "Error" },
    switchLang: "RU"
  },
  ru: {
    title: "AVA Студия",
    create: "Создать задачу",
    generating: "Генерация...",
    history: "История",
    login: "Войти через Google",
    themes: { light: "Светлая", dark: "Тёмная", cyber: "Кибер" },
    status: { CREATED: "В очереди", RUNNING: "Обработка", COMPLETED: "Готово", FAILED: "Ошибка" },
    switchLang: "EN"
  }
};
