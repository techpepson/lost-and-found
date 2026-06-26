import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Camera, MapPin, Calendar, Tag, Image as ImageIcon } from "lucide-react-native";
import { colors, borderRadius, spacing, typography, shadows } from "@/constants/theme";
import { ItemCategory, ItemStatus } from "@/types";
import { StatusToggle } from "@/components/StatusToggle";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const CATEGORIES: ItemCategory[] = [
  "Phone",
  "Wallet",
  "ID Card",
  "Bag",
  "Keys",
  "Others",
];

export default function PostScreen() {
  const [status, setStatus] = useState<ItemStatus>("lost");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ItemCategory>("Others");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const router = useRouter();

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Denied", "You need to allow gallery access to pick images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Denied", "You need to allow camera access to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const selectImageSource = () => {
    Alert.alert(
      "Select Image",
      "Choose a method to add an image",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleSubmit = async () => {
    if (!title || !description || !location || !date) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be signed in to post");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = "";

      if (imageUri) {
        // Upload image to Firebase Storage
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const filename = imageUri.substring(imageUri.lastIndexOf("/") + 1);
        const storageRef = ref(storage, `items/${user.uid}/${Date.now()}_${filename}`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      const itemData = {
        title,
        description,
        status,
        category,
        location,
        date,
        imageUrl: imageUrl || null,
        authorId: user.uid,
        authorEmail: user.email,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "items"), itemData);

      Alert.alert("Success", "Item posted successfully", [
        {
          text: "OK",
          onPress: () => {
            setTitle("");
            setDescription("");
            setCategory("Others");
            setLocation("");
            setDate(new Date().toLocaleDateString());
            setImageUri(null);
            setStatus("lost");
            router.replace("/(tabs)");
          },
        },
      ]);
    } catch (error: any) {
      console.error("Error creating post:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Post New Item</Text>
            <Text style={styles.headerSubtitle}>Provide details about the lost or found item</Text>
          </View>

          <StatusToggle value={status} onChange={setStatus} />

          <View style={styles.form}>
            {/* Image Picker */}
            <TouchableOpacity style={styles.imagePicker} onPress={selectImageSource} activeOpacity={0.8}>
              {imageUri ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  <View style={styles.changeImageOverlay}>
                    <Camera size={20} color={colors.textInverse} />
                    <Text style={styles.changeImageText}>Change Photo</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.placeholderContainer}>
                  <ImageIcon size={36} color={colors.textTertiary} />
                  <Text style={styles.placeholderText}>Add a Photo</Text>
                  <Text style={styles.placeholderHint}>Tap to open camera or gallery</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., iPhone 13 Pro Max, Black Leather Wallet"
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
                maxLength={60}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe key features, colors, brands, or unique marks..."
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Category selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoriesContainer}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, isSelected && styles.selectedCategoryChip]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[styles.categoryChipText, isSelected && styles.selectedCategoryChipText]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location {status === "lost" ? "Lost" : "Found"}</Text>
              <View style={styles.inputIconWrapper}>
                <MapPin size={18} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="e.g., Central Library, Building B Room 404"
                  placeholderTextColor={colors.textTertiary}
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
            </View>

            {/* Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date {status === "lost" ? "Lost" : "Found"}</Text>
              <View style={styles.inputIconWrapper}>
                <Calendar size={18} color={colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="e.g., 2026-06-25, Today"
                  placeholderTextColor={colors.textTertiary}
                  value={date}
                  onChangeText={setDate}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.9}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.submitButtonText}>Publish Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
  },
  form: {
    padding: spacing.md,
    gap: spacing.md,
  },
  imagePicker: {
    height: 180,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  imageContainer: {
    width: "100%",
    height: "100%",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  changeImageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    gap: 6,
  },
  changeImageText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: "600",
  },
  placeholderContainer: {
    alignItems: "center",
    gap: 4,
  },
  placeholderText: {
    ...typography.h4,
    color: colors.textSecondary,
  },
  placeholderHint: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.bodySmall,
    ...shadows.sm,
  },
  inputIconWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  inputIcon: {
    position: "absolute",
    left: spacing.md,
    zIndex: 10,
  },
  inputWithIcon: {
    paddingLeft: spacing.md + 24,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedCategoryChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  selectedCategoryChipText: {
    color: colors.textInverse,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    ...shadows.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.primaryLight,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.textInverse,
  },
});
