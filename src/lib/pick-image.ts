import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

export async function chooseImage(): Promise<string | null> {
  const select = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Camera access is disabled. Allow it in your device settings or choose a photo from your library.",
        );
    }
    const result = await (camera
      ? ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.85,
          exif: false,
        })
      : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.85,
          exif: false,
        }));
    return result.canceled ? null : (result.assets[0]?.uri ?? null);
  };
  if (Platform.OS === "web") return select(false);
  let selected = false;
  return new Promise((resolve, reject) =>
    Alert.alert(
      "Add a photo",
      "Choose how to add your image.",
      [
        {
          text: "Take a photo",
          onPress: () => {
            selected = true;
            void select(true).then(resolve, reject);
          },
        },
        {
          text: "Photo library",
          onPress: () => {
            selected = true;
            void select(false).then(resolve, reject);
          },
        },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          if (!selected) resolve(null);
        },
      },
    ),
  );
}
