// Animated 3-dot component
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, Image, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

function AnimatedDots() {
  const [dotCount, setDotCount] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return (
    <Text style={{ color: '#fff', fontSize: 22, letterSpacing: 2 }}>{'.'.repeat(dotCount)}</Text>
  );
}

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Hello this is SmartBiz.ai' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('chat_messages');
        if (saved) setMessages(JSON.parse(saved));
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('chat_messages', JSON.stringify(messages));
  }, [messages]);

  const BACKEND_URL = "https://kujto-ai.onrender.com/chat";
  const POLLINATIONS_URL = "https://kujto-ai.onrender.com/generate-image";
  const VISION_URL = "https://kujto-ai.onrender.com/image-to-text";
  const IMAGE2IMAGE_URL = "https://kujto-ai.onrender.com/image-to-image";

  const handleImagePress = (url) => {
    setModalImageUrl(url);
    setModalVisible(true);
  };
  const handleDownloadImage = async () => {
    if (!modalImageUrl) return;
    try {
      const fileUri = `${FileSystem.documentDirectory}${Date.now()}.jpg`;
      const result = await FileSystem.downloadAsync(modalImageUrl, fileUri);
      Alert.alert('Image saved!', `Saved to: ${result.uri}`);
    } catch (e) {
      Alert.alert('Download failed', e.message);
    }
  };

  const handleGoToChat = () => {
    router.push('/');
  };
  const handleGoToVideo = () => {
    router.push('/AIVideo');
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    if (selectedImage) {
      if (/describe|what is|analyze|explain|text|caption|summarize|content|recognize|identify/i.test(input)) {
        setMessages((prev) => [...prev, { role: 'user', content: `[Image-to-text: ${input}]`, imageUrl: selectedImage.uri }]);
        try {
          let localUri = selectedImage.uri;
          let filename = localUri.split('/').pop();
          let match = /\.([^.]+)$/.exec(filename);
          let type = match && match[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
          if (!localUri.startsWith('file://')) localUri = 'file://' + localUri;
          let formData = new FormData();
          formData.append('image', { uri: localUri, name: filename, type });
          const res = await fetch(VISION_URL, {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.reply) {
            setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
          }
        } catch (err) {
          setError('Network error.');
        }
        setSelectedImage(null);
        setInput("");
        setLoading(false);
        return;
      }
      let formData = new FormData();
      let localUri = selectedImage.uri;
      let filename = localUri.split('/').pop();
      let match = /\.([^.]+)$/.exec(filename);
      let type = match && match[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
      if (!localUri.startsWith('file://')) localUri = 'file://' + localUri;
      formData.append('init_image', { uri: localUri, name: filename, type });
      formData.append('prompt', input);
      // Show prompt and image in chat as soon as user sends
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: input,
          imageUrl: selectedImage.uri
        }
      ]);
      try {
        const res = await fetch(IMAGE2IMAGE_URL, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        let url = data.imageUrl || data.image_url || data.image || (data.output && data.output[0]);
        if (url) {
          setMessages((prev) => [...prev, { role: 'image', imageUrl: url, content: `Image-to-image result for: ${input}` }]);
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
    const userMsg = { role: 'user', content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    try {
      const res = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages })
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

  const handlePickImage = async () => {
    let pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false });
    if (pickerResult.cancelled) return;
    let asset = pickerResult.assets ? pickerResult.assets[0] : pickerResult;
    setSelectedImage(asset);
  };

  const handleTakePhoto = async () => {
    let pickerResult = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, base64: false });
    if (pickerResult.cancelled) return;
    let asset = pickerResult.assets ? pickerResult.assets[0] : pickerResult;
    setSelectedImage(asset);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#181A20' }]}> 
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}> 
            <TouchableOpacity style={{ position: 'absolute', left: 18, top: 44 }}>
              <Ionicons name="menu-outline" size={32} color="#7B4DFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <TouchableOpacity 
                style={{ backgroundColor: '#7B4DFF', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 22, marginHorizontal: 4 }}
                onPress={handleGoToChat}
                disabled={true}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ backgroundColor: '#23242A', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 22, marginHorizontal: 4 }}
                onPress={handleGoToVideo}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Video</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ position: 'absolute', right: 18, top: 44 }}>
              <Ionicons name="chatbubbles-outline" size={28} color="#7B4DFF" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {messages.map((msg, idx) => (
              <View
                key={idx}
                style={
                  msg.role === 'user'
                    ? [styles.bubble, styles.userBubble]
                    : [styles.bubble, styles.assistantBubble]
                }
              >
                {msg.imageUrl ? (
                  <>
                    <TouchableOpacity onPress={() => handleImagePress(msg.imageUrl)}>
                      <Image source={{ uri: msg.imageUrl }} style={{ width: 220, height: 220, borderRadius: 16, marginBottom: 8 }} resizeMode="cover" />
                    </TouchableOpacity>
                    {msg.content ? <Text style={styles.bubbleText}>{msg.content}</Text> : null}
                  </>
                ) : (
                  <Text style={styles.bubbleText}>{msg.content}</Text>
                )}
                {/* Restart icon under user prompt */}
                {msg.role === 'user' && (
                  <TouchableOpacity
                    style={{ alignSelf: 'flex-end', marginTop: 6, marginRight: 2 }}
                    onPress={() => {
                      setInput(msg.content || "");
                      if (msg.imageUrl) setSelectedImage({ uri: msg.imageUrl });
                      else setSelectedImage(null);
                    }}
                    accessibilityLabel="Restart this question"
                  >
                    <Ionicons name="refresh" size={20} color="#FFD700" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {loading && (
              <View style={[styles.bubble, styles.assistantBubble]}> 
                <AnimatedDots />
              </View>
            )}
            {error ? (
              <Text style={{ color: 'red', marginTop: 10 }}>{error}</Text>
            ) : null}
          </ScrollView>
          <Modal visible={modalVisible} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20 }} onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>
              {modalImageUrl && (
                <Image source={{ uri: modalImageUrl }} style={{ width: '90%', height: '70%', borderRadius: 20 }} resizeMode="contain" />
              )}
              <TouchableOpacity style={{ marginTop: 24, backgroundColor: '#FFD700', padding: 12, borderRadius: 10 }} onPress={handleDownloadImage}>
                <Text style={{ color: '#222', fontWeight: 'bold' }}>Download Image</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </View>
        <View style={[styles.inputBar, { borderWidth: 2, borderColor: '#7B4DFF', borderRadius: 28 }]}> 
          <TouchableOpacity style={styles.inputIconButton} onPress={handlePickImage} disabled={loading}>
            <Ionicons name={selectedImage ? "image" : "image-outline"} size={22} color={selectedImage ? "#FFD700" : "#fff"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputIconButton} onPress={handleTakePhoto} disabled={loading}>
            <Ionicons name="camera-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type your question..."
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            editable={!loading}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={loading}>
            <Ionicons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        {selectedImage && (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Image source={{ uri: selectedImage.uri }} style={{ width: 80, height: 80, borderRadius: 10, marginTop: 4 }} />
            <Text style={{ color: '#fff', fontSize: 12 }}>Image selected for image-to-image</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#23242A',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  content: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 20,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    marginLeft: 8,
    marginRight: 8,
  },
  userBubble: {
    backgroundColor: '#2A2D34',
    alignSelf: 'flex-end',
    borderTopRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: '#23242A',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 6,
  },
  bubbleText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#23242A',
    borderRadius: 28,
    margin: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  sendButton: {
    backgroundColor: '#A259F7',
    borderRadius: 20,
    padding: 8,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIconButton: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    padding: 6,
    marginRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});