import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

const dsn =
  Constants.expoConfig?.extra?.sentryDsn ??
  "https://82a04bb3fc33224547618fe7dfa5b2c5@o4511998384799744.ingest.de.sentry.io/4511998426808400";

Sentry.init({
  dsn,
  // Los fallos de desarrollo no deben mezclarse con problemas reales ni
  // enviar diagnósticos desde el emulador del equipo de trabajo.
  enabled: !__DEV__ && Boolean(dsn),
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  beforeSend(event) {
    // Los diagnósticos sirven para encontrar el lugar del fallo; no necesitan
    // la identidad de la persona, datos de red ni valores añadidos por la app.
    delete event.user;
    delete event.request;
    delete event.extra;
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(({ data: _data, ...breadcrumb }) => breadcrumb);
    }
    return event;
  },
});

export { Sentry };
