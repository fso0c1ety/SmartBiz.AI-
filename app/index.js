import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Hello this is SmartBiz.ai' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null); // For image-to-image

  const BACKEND_URL = "https://kujto-ai.onrender.com/chat";
  const POLLINATIONS_URL = "https://kujto-ai.onrender.com/generate-image";
  const VISION_URL = "https://kujto-ai.onrender.com/image-to-text";
  const IMAGE2IMAGE_URL = "https://kujto-ai.onrender.com/image-to-image";


  // Unified send handler
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    // If user uploaded an image and entered a prompt, do image-to-image
    if (selectedImage) {
      setMessages((prev) => [...prev, { role: 'user', content: `[Image-to-image: ${input}]`, imageUrl: selectedImage.uri }]);
      try {
        let localUri = selectedImage.uri;
        let filename = localUri.split('/').pop();
        let match = /\.([^.]+)$/.exec(filename);
        let type = match && match[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
        if (!localUri.startsWith('file://')) localUri = 'file://' + localUri;
        let formData = new FormData();
        formData.append('init_image', { uri: localUri, name: filename, type });
        formData.append('prompt', input);
        const res = await fetch('http://localhost:8080/image-to-image', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.image_url || data.imageUrl) {
          setMessages((prev) => [...prev, { role: 'image', imageUrl: data.image_url || data.imageUrl, content: `Image-to-image result for: ${input}` }]);
        } else {
          setError(data.error || 'No image returned.');
        }
      } catch (err) {
        setError('Network error.');
      }
      setSelectedImage(null);
      setInput("");
      setLoading(false);
      return;
    }
    // If prompt looks like an image generation request, use Pollinations
    if (/generate an? image of|draw|create an? image of|make an? image of|picture of|image of|photo of/i.test(input)) {
      setMessages((prev) => [...prev, { role: 'user', content: input }]);
      try {
        const res = await fetch(POLLINATIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input })
        });
        const data = await res.json();
        if (data.imageUrl) {
          setMessages((prev) => [...prev, { role: 'image', imageUrl: data.imageUrl, content: `Generated image for: ${input}` }]);
        } else {
          setError(data.error || 'No image generated.');
        }
      } catch (err) {
        setError('Network error.');
      }
      setInput("");
      setLoading(false);
      return;
    }
    // Otherwise, normal chat
    const userMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setError(data.error || 'No reply from server.');
      }
    } catch (err) {
      setError('Network error.');
    }
    setInput("");
    setLoading(false);
  };

  // Image picker for image-to-image
  const handlePickImage = async () => {
    let pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false });
    if (pickerResult.cancelled) return;
    let asset = pickerResult.assets ? pickerResult.assets[0] : pickerResult;
    setSelectedImage(asset);
  };

  // Take photo for image-to-image
  const handleTakePhoto = async () => {
    let pickerResult = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false });
    if (pickerResult.cancelled) return;
    let asset = pickerResult.assets ? pickerResult.assets[0] : pickerResult;
    setSelectedImage(asset);
  };

  return (
    <LinearGradient
      colors={["#7B2FF2", "#F357A8"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>SmartBiz.AI</Text>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {messages.map((msg, idx) => (
              <View
                key={idx}
                style={
                  msg.role === 'user'
                    ? [styles.questionBox, { alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.18)' }]
                    : [styles.answerBox, { alignSelf: 'flex-start' }]
                }
              >
                {msg.role === 'image' ? (
                  <>
                    <Image source={{ uri: msg.imageUrl }} style={{ width: 220, height: 220, borderRadius: 16, marginBottom: 8 }} resizeMode="cover" />
                    <Text style={styles.answerText}>{msg.content}</Text>
                  </>
                ) : msg.role === 'assistant' || msg.role === 'system' ? (
                  <>
                    <View style={styles.iconCircle}>
                      <Ionicons name="flower-outline" size={32} color="#A259F7" />
                    </View>
                    <Text style={styles.answerText}>{msg.content}</Text>
                  </>
                ) : (
                  <Text style={styles.questionText}>{msg.content}</Text>
                )}
              </View>
            ))}
            {loading && (
              <View style={[styles.answerBox, { alignSelf: 'flex-start' }]}> 
                <View style={styles.iconCircle}>
                  <Ionicons name="flower-outline" size={32} color="#A259F7" />
                </View>
                <Text style={styles.answerText}>Thinking...</Text>
              </View>
            )}
            {error ? (
              <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>
            ) : null}
          </ScrollView>
        </View>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type your message or prompt..."
            placeholderTextColor="#ccc"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            editable={!loading}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.iconButton} onPress={handlePickImage} disabled={loading}>
            <Ionicons name={selectedImage ? "image" : "image-outline"} size={24} color={selectedImage ? "#FFD700" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleTakePhoto} disabled={loading}>
            <Ionicons name="camera-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={loading}>
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        {selectedImage && (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Image source={{ uri: selectedImage.uri }} style={{ width: 80, height: 80, borderRadius: 10, marginTop: 4 }} />
            <Text style={{ color: '#fff', fontSize: 12 }}>Image selected for image-to-image</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  questionBox: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    width: '100%',
  },
  questionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  answerBox: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 22,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  iconCircle: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  answerText: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
  },
  stepTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 2,
  },
  stepText: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 6,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 30,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sendButton: {
    backgroundColor: '#A259F7',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
  },
  iconButton: {
    backgroundColor: '#A259F7',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
