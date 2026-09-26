import React, { useState, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

// ---- Configuration ----------------------------------------------------

// Preset target sizes (longest-edge width in px). "Original" keeps native size.
const SIZE_PRESETS = [
  { key: "thumb", label: "Thumbnail", width: 150 },
  { key: "small", label: "Small", width: 320 },
  { key: "medium", label: "Medium", width: 720 },
  { key: "large", label: "Large", width: 1080 },
  { key: "original", label: "Original size", width: null },
];

// Output formats supported by expo-image-manipulator
const FORMAT_OPTIONS = [
  { key: "jpeg", label: "JPEG", saveFormat: ImageManipulator.SaveFormat.JPEG, ext: "jpg" },
  { key: "png", label: "PNG", saveFormat: ImageManipulator.SaveFormat.PNG, ext: "png" },
  { key: "webp", label: "WEBP", saveFormat: ImageManipulator.SaveFormat.WEBP, ext: "webp" },
];

// ---- Helpers ------------------------------------------------------------

function sanitizeBaseName(uri) {
  const fileName = uri.split("/").pop() || "image";
  return fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");
}

// ---- Main component -------------------------------------------------------

export default function App() {
  const [sourceImage, setSourceImage] = useState(null); // { uri, width, height }
  const [selectedSizes, setSelectedSizes] = useState(["small", "medium"]);
  const [selectedFormats, setSelectedFormats] = useState(["jpeg"]);
  const [results, setResults] = useState([]); // [{ key, label, uri, width, height, sizeBytes }]
  const [isProcessing, setIsProcessing] = useState(false);

  const jobCount = useMemo(
    () => selectedSizes.length * selectedFormats.length,
    [selectedSizes, selectedFormats]
  );

  // ---- Image selection ----------------------------------------------------

  const pickImage = async (fromCamera) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        fromCamera
          ? "Camera access is required to take a photo."
          : "Photo library access is required to pick an image."
      );
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
        });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setSourceImage({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    });
    setResults([]);
  };

  // ---- Selection toggles ----------------------------------------------------

  const toggleSize = (key) => {
    setSelectedSizes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleFormat = (key) => {
    setSelectedFormats((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ---- Conversion ----------------------------------------------------

  const runConversion = async () => {
    if (!sourceImage) {
      Alert.alert("No image", "Pick an image first.");
      return;
    }
    if (selectedSizes.length === 0 || selectedFormats.length === 0) {
      Alert.alert("Nothing selected", "Choose at least one size and one format.");
      return;
    }

    setIsProcessing(true);
    setResults([]);
    const baseName = sanitizeBaseName(sourceImage.uri);
    const outputs = [];

    try {
      for (const sizeKey of selectedSizes) {
        const preset = SIZE_PRESETS.find((s) => s.key === sizeKey);
        const resizeAction = preset.width
          ? [{ resize: { width: preset.width } }]
          : [];

        for (const formatKey of selectedFormats) {
          const format = FORMAT_OPTIONS.find((f) => f.key === formatKey);

          const manipulated = await ImageManipulator.manipulateAsync(
            sourceImage.uri,
            resizeAction,
            {
              compress: format.key === "png" ? 1 : 0.85,
              format: format.saveFormat,
            }
          );

          // Copy to a nicely named file so exports/shares have a clean filename.
          const fileName = `${baseName}_${preset.key}.${format.ext}`;
          const destUri = `${FileSystem.cacheDirectory}${fileName}`;
          await FileSystem.copyAsync({ from: manipulated.uri, to: destUri });
          const info = await FileSystem.getInfoAsync(destUri, { size: true });

          outputs.push({
            key: `${sizeKey}_${formatKey}`,
            label: `${preset.label} · ${format.label}`,
            uri: destUri,
            width: manipulated.width,
            height: manipulated.height,
            sizeBytes: info.size || 0,
          });
        }
      }
      setResults(outputs);
    } catch (err) {
      console.error(err);
      Alert.alert("Conversion failed", err.message || "Something went wrong.");
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- Save / Share ----------------------------------------------------

  const saveToGallery = async (item) => {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library access is required to save images.");
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(item.uri);
      Alert.alert("Saved", `${item.label} saved to your photo library.`);
    } catch (err) {
      Alert.alert("Save failed", err.message || "Could not save image.");
    }
  };

  const saveAllToGallery = async () => {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library access is required to save images.");
      return;
    }
    try {
      for (const item of results) {
        await MediaLibrary.saveToLibraryAsync(item.uri);
      }
      Alert.alert("Saved", `${results.length} image(s) saved to your photo library.`);
    } catch (err) {
      Alert.alert("Save failed", err.message || "Could not save all images.");
    }
  };

  const shareImage = async (item) => {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("Sharing unavailable", "Sharing is not supported on this device.");
      return;
    }
    await Sharing.shareAsync(item.uri);
  };

  // ---- Render ----------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Image Converter</Text>
        <Text style={styles.subtitle}>
          Resize and convert an image to multiple sizes and formats at once.
        </Text>

        {/* Image picker */}
        <View style={styles.card}>
          {sourceImage ? (
            <Image source={{ uri: sourceImage.uri }} style={styles.preview} resizeMode="contain" />
          ) : (
            <View style={[styles.preview, styles.previewPlaceholder]}>
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
          {sourceImage && (
            <Text style={styles.metaText}>
              Original: {sourceImage.width} × {sourceImage.height}px
            </Text>
          )}
          <View style={styles.row}>
            <TouchableOpacity style={styles.button} onPress={() => pickImage(false)}>
              <Text style={styles.buttonText}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => pickImage(true)}>
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Size selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sizes</Text>
          <View style={styles.chipRow}>
            {SIZE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.key}
                style={[
                  styles.chip,
                  selectedSizes.includes(preset.key) && styles.chipSelected,
                ]}
                onPress={() => toggleSize(preset.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSizes.includes(preset.key) && styles.chipTextSelected,
                  ]}
                >
                  {preset.label}
                  {preset.width ? ` (${preset.width}px)` : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Format selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Formats</Text>
          <View style={styles.chipRow}>
            {FORMAT_OPTIONS.map((format) => (
              <TouchableOpacity
                key={format.key}
                style={[
                  styles.chip,
                  selectedFormats.includes(format.key) && styles.chipSelected,
                ]}
                onPress={() => toggleFormat(format.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedFormats.includes(format.key) && styles.chipTextSelected,
                  ]}
                >
                  {format.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Convert button */}
        <TouchableOpacity
          style={[styles.convertButton, (!sourceImage || isProcessing) && styles.buttonDisabled]}
          onPress={runConversion}
          disabled={!sourceImage || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.convertButtonText}>
              Convert{jobCount ? ` (${jobCount} output${jobCount > 1 ? "s" : ""})` : ""}
            </Text>
          )}
        </TouchableOpacity>

        {/* Results */}
        {results.length > 0 && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Results</Text>
              <TouchableOpacity onPress={saveAllToGallery}>
                <Text style={styles.saveAllText}>Save all</Text>
              </TouchableOpacity>
            </View>
            {results.map((item) => (
              <View key={item.key} style={styles.resultRow}>
                <Image source={{ uri: item.uri }} style={styles.resultThumb} />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultLabel}>{item.label}</Text>
                  <Text style={styles.resultMeta}>
                    {item.width}×{item.height}px · {(item.sizeBytes / 1024).toFixed(0)} KB
                  </Text>
                </View>
                <View style={styles.resultActions}>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => saveToGallery(item)}
                  >
                    <Text style={styles.smallButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => shareImage(item)}
                  >
                    <Text style={styles.smallButtonText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Styles ----------------------------------------------------

const ACCENT = "#6366F1";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#111827",
  },
  container: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#F9FAFB",
    marginTop: Platform.OS === "android" ? 16 : 0,
  },
  subtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F9FAFB",
    marginBottom: 10,
  },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    backgroundColor: "#111827",
    marginBottom: 10,
  },
  previewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#6B7280",
  },
  metaText: {
    color: "#9CA3AF",
    fontSize: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  button: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#F9FAFB",
    fontWeight: "600",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#374151",
  },
  chipSelected: {
    backgroundColor: ACCENT,
  },
  chipText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#fff",
  },
  convertButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  convertButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  saveAllText: {
    color: ACCENT,
    fontWeight: "600",
    fontSize: 13,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  resultThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#111827",
    marginRight: 10,
  },
  resultInfo: {
    flex: 1,
  },
  resultLabel: {
    color: "#F9FAFB",
    fontWeight: "600",
    fontSize: 13,
  },
  resultMeta: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  resultActions: {
    flexDirection: "row",
    gap: 6,
  },
  smallButton: {
    backgroundColor: "#374151",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  smallButtonText: {
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: "600",
  },
});
