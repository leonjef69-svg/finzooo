import { Modal, type ModalProps } from "react-native";
import { useAppLocked } from "@/utils/lockState";

/** Se recrea tras comprobar el candado para heredar FLAG_SECURE de Android. */
export default function PrivateModal(props: ModalProps) {
  const locked = useAppLocked();
  if (locked) return null;
  return <Modal {...props} />;
}
