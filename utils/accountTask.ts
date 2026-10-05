import { auth } from "@/utils/firebase";
import { getAccountStorageSession } from "@/utils/storage";

/** Una respuesta de A no puede escribir en B, ni en una nueva sesión de A. */
export function captureAccountTask(uid: string, active: () => boolean = () => true) {
  const session = getAccountStorageSession();
  const current = () => !!uid && session !== null && active()
    && auth.currentUser?.uid === uid && getAccountStorageSession() === session;
  const assertCurrent = () => { if (!current()) throw new Error("account-task-obsolete"); };
  const wait = async <T>(work: () => Promise<T>): Promise<T> => {
    assertCurrent();
    const result = await work();
    assertCurrent();
    return result;
  };
  return { current, wait };
}

export type AccountTaskWait = ReturnType<typeof captureAccountTask>["wait"];
