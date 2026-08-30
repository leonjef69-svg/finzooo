import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

const dsn =
  Constants.expoConfig?.extra?.sentryDsn ??
  "https://82a04bb3fc33224547618fe7dfa5b2c5@o4511998384799744.ingest.de.sentry.io/4511998426808400";

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.2,
});

export { Sentry };
