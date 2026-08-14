import Clipboard from '@react-native-clipboard/clipboard';
import { Share } from 'react-native';

export type ResultActions = {
  copy(text: string): void;
  share(text: string): Promise<void>;
};

export const platformResultActions: ResultActions = {
  copy(text) {
    Clipboard.setString(text);
  },
  async share(text) {
    await Share.share({ message: text });
  },
};
