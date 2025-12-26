import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

export default function AIVideo() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [persistedImageUrl, setPersistedImageUrl] = useState(null);

  // Resume pending generation on mount
  // Fetch video history from backend on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://kujto-ai.onrender.com/video-history', {
          method: 'GET',
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setMessages(data);
        } else if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (e) {
        setMessages([]);
      }
    })();
  }, []);

  const handleGenerate = async (isResume = false) => {
    if ((!prompt.trim() && !selectedImage) || loading) return;
    setLoading(true);
    setError("");
    setMessages(prev => [
      ...prev,
      { role: 'user', content: prompt, image: selectedImage?.uri }
    ]);
    // Save video history to backend
    if (!isResume) {
      try {
        await fetch('https://kujto-ai.onrender.com/video-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [...messages, { role: 'user', content: prompt, image: selectedImage?.uri }] })
        });
      } catch (e) { console.log('Failed to persist video history:', e); }
    }
    // 1. If image is selected, always use image-to-video
    try {
      if (selectedImage) {
        let durationMatch = prompt.match(/(\d+)\s*s\s*video/i);
        let duration = durationMatch ? parseInt(durationMatch[1]) : 5;
        const apiKey = "Cp790n9sL087P3wLcxo6aJPVUifFPE7pPxVlnNO9K6QKlekEut7YMjBsCqv2";
        let formData = new FormData();
        let localUri = selectedImage.uri;
        let filename = localUri.split('/').pop();
        let match = /\.([^.]+)$/.exec(filename);
        let type = match && match[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
        if (!localUri.startsWith('file://')) localUri = 'file://' + localUri;
        formData.append('init_image', { uri: localUri, name: filename, type });
        formData.append('prompt', prompt);
        formData.append('duration', String(duration));
        formData.append('key', apiKey);
        try {
          const response = await fetch('https://kujto-ai.onrender.com/image-to-video', {
            method: 'POST',
            body: formData // Do NOT set headers, let fetch handle it
          });
          const data = await response.json();
          console.log('Backend image-to-video response:', data);
          if (data.status === 'success' && data.data && data.data.id) {
            // Persist the image used for image-to-video
            try {
              await AsyncStorage.setItem('lastGeneratedImageUrl', data.data.input_image || localUri);
              setPersistedImageUrl(data.data.input_image || localUri);
              await AsyncStorage.removeItem('pendingGeneration');
            } catch (e) {
              console.log('Failed to persist image-to-video image URL:', e);
            }
            setPrompt("");
            setSelectedImage(null);
            setLoading(false);
            router.push({
              pathname: '/VideoLoading',
              params: { id: data.data.id, prompt, duration, image: data.data.input_image || '' },
            });
            return;
          } else if (data.status === 'processing' && data.fetch_result) {
            await AsyncStorage.removeItem('pendingGeneration');
            setPrompt("");
            setLoading(false);
            router.push({
              pathname: '/VideoLoading',
              params: {
                prompt,
                fetchResultUrl: data.fetch_result,
                apiKey,
                duration
              }
            });
            return;
          } else {
            await AsyncStorage.removeItem('pendingGeneration');
            setError((data.message || data.error || 'Failed to start image-to-video generation.'));
            alert('Image-to-video error: ' + (data.message || data.error || 'Failed to start image-to-video generation.'));
          }
        } catch (err) {
          await AsyncStorage.removeItem('pendingGeneration');
          setError('Network or fetch error: ' + err.message);
          alert('Image-to-video network error.');
        }
        setPrompt("");
        setLoading(false);
        return;
      }
      // 2. If only text and prompt contains 'video', use text-to-video
      if (!selectedImage && /video/i.test(prompt)) {
        let durationMatch = prompt.match(/(\d+)\s*s\s*video/i);
        let duration = durationMatch ? parseInt(durationMatch[1]) : 5;
        const apiKey = "Cp790n9sL087P3wLcxo6aJPVUifFPE7pPxVlnNO9K6QKlekEut7YMjBsCqv2";
        const payload = {
          prompt: prompt.trim(),
          model_id: "seedance-1-5-pro",
          aspect_ratio: "9:16",
          duration,
          key: apiKey
        };
        try {
          const response = await fetch("https://modelslab.com/api/v7/video-fusion/text-to-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await response.json();
          console.log('Text-to-video response:', data);
          if (data.video_url || data.videoUrl || data.url) {
            let url = data.video_url || data.videoUrl || data.url;
            setMessages(prev => [
              ...prev,
              { role: 'video', videoUrl: url, content: `Generated video for: ${prompt}` }
            ]);
          } else if (data.status === 'processing' && data.fetch_result) {
            setPrompt("");
            setLoading(false);
            router.push({
              pathname: '/VideoLoading',
              params: {
                prompt,
                fetchResultUrl: data.fetch_result,
                apiKey,
                duration
              }
            });
          } else {
            setError((data.error && typeof data.error === 'string') ? data.error : JSON.stringify(data));
            alert('Text-to-video error: ' + ((data.error && typeof data.error === 'string') ? data.error : JSON.stringify(data)));
          }
        } catch (err) {
          setError('Network error.');
          alert('Text-to-video network error.');
        }
        setPrompt("");
        setLoading(false);
        return;
      }
      // 3. If only text and prompt is for image, use text-to-image
      if (!selectedImage && /generate an? image of|draw|create an? image of|make an? image of|picture of|image of|photo of/i.test(prompt)) {
        try {
          const res = await fetch('https://kujto-ai.onrender.com/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });
          const data = await res.json();
          console.log('Text-to-image response:', data);
          if (data.imageUrl) {
            setMessages(prev => [...prev, { role: 'image', imageUrl: data.imageUrl, content: `Generated image for: ${prompt}` }]);
            try {
              await AsyncStorage.setItem('lastGeneratedImageUrl', data.imageUrl);
              setPersistedImageUrl(data.imageUrl);
              await AsyncStorage.removeItem('pendingGeneration');
            } catch (e) {
              console.log('Failed to persist image URL:', e);
            }
          } else {
            await AsyncStorage.removeItem('pendingGeneration');
            setError(data.error || 'No image generated.');
            alert('Text-to-image error: ' + (data.error || 'No image generated.'));
          }
        } catch (err) {
          await AsyncStorage.removeItem('pendingGeneration');
          setError('Network error.');
          alert('Text-to-image network error.');
        }
        setPrompt("");
        setLoading(false);
        return;
      }
      // Fallback log for all handleGenerate branches
      if (!selectedImage && !/generate an? image of|draw|create an? image of|make an? image of|picture of|image of|photo of|video/i.test(prompt)) {
        console.log('Prompt did not match any handler:', prompt);
      }
    } catch (e) {
      setError('Error generating video: ' + (e?.message || e));
      setLoading(false);
    }
  };

  // Load persisted image on mount
  useEffect(() => {
    (async () => {
      try {
        const url = await AsyncStorage.getItem('lastGeneratedImageUrl');
        if (url) setPersistedImageUrl(url);
      } catch (e) {
        console.log('Failed to load persisted image URL:', e);
      }
    })();
  }, []);

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const { router } = require('expo-router');
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <View style={styles.container}>
        {/* Top navigation buttons */}
        <View style={[styles.header, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 }]}> 
          <TouchableOpacity style={{ backgroundColor: '#23242A', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 22, marginHorizontal: 4 }} onPress={() => router.push('/')}> 
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: '#7B4DFF', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 22, marginHorizontal: 4 }} onPress={() => router.push('/AIVideo')} disabled={true}> 
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ position: 'absolute', right: 10, top: 0, padding: 8 }} onPress={() => router.push('/VideoLoading')}>
            <Ionicons name="albums-outline" size={28} color="#FFD700" />
          </TouchableOpacity>
        </View>
        {/* Heading for video section */}
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12, marginTop: 8 }}>
          AI Product Video Generations
        </Text>
        {/* AI Video Generated Templates - 6 videos, 2 per row, scrollable */}
        <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
          {(() => {
            let videos = [
              require('../assets/Videos/bag_right.webm'),
              require('../assets/Videos/beauty_right.webm'),
              require('../assets/Videos/mobile_right.webm'),
              require('../assets/Videos/glass_right.webm'),
              require('../assets/Videos/table_right.webm'),
              require('../assets/Videos/ssstik.io_@katlok.ai_1766624021113.webm'),
            ];
            // Only use the first 6 valid videos
            videos = videos.filter(Boolean).slice(0, 6);
            const rows = [];
            for (let i = 0; i < videos.length; i += 2) {
              rows.push(
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ width: '48%', aspectRatio: 0.6, backgroundColor: '#222', borderRadius: 18, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                    {videos[i] ? (
                      <Video
                        source={videos[i]}
                        style={{ width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden' }}
                        shouldPlay
                        isLooping
                        isMuted
                        resizeMode="cover"
                        onError={e => console.log('Video error slot', i, e)}
                      />
                    ) : (
                      <Text style={{ color: '#fff', textAlign: 'center' }}>No video</Text>
                    )}
                  </View>
                  <View style={{ width: '48%', aspectRatio: 0.6, backgroundColor: '#222', borderRadius: 18, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                    {videos[i + 1] ? (
                      <Video
                        source={videos[i + 1]}
                        style={{ width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden' }}
                        shouldPlay
                        isLooping
                        isMuted
                        resizeMode="cover"
                        onError={e => console.log('Video error slot', i + 1, e)}
                      />
                    ) : (
                      <Text style={{ color: '#fff', textAlign: 'center' }}>No video</Text>
                    )}
                  </View>
                </View>
              );
            }
            return rows;
          })()}
        </ScrollView>
        {/* Bottom video generation UI */}
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.subtitle}>Describe the video you want to generate:</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', borderRadius: 28, marginVertical: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 2, borderColor: '#7B4DFF', borderRadius: 28 }}>
            <TextInput
              style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: 'transparent' }}
              placeholder="Enter your video prompt... (e.g. generate a 3s video of a cat)"
              placeholderTextColor="#aaa"
              value={prompt}
              onChangeText={setPrompt}
              editable={!loading}
              returnKeyType="send"
              onSubmitEditing={handleGenerate}
            />
            <TouchableOpacity style={{ backgroundColor: '#7B4DFF', borderRadius: 20, padding: 8, marginLeft: 6, alignItems: 'center', justifyContent: 'center' }} onPress={handleGenerate} disabled={loading || (!prompt.trim() && !selectedImage)}>
              {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={22} color="#fff" />}
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: '#23242A', borderRadius: 20, padding: 8, marginLeft: 6, alignItems: 'center', justifyContent: 'center' }} onPress={handlePickImage} disabled={loading}>
              <Ionicons name="image-outline" size={22} color="#FFD700" />
            </TouchableOpacity>
          </View>
          {selectedImage && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 8 }}>
              <Image source={{ uri: selectedImage.uri }} style={{ width: 60, height: 60, borderRadius: 10, marginRight: 8 }} />
              <TouchableOpacity onPress={handleRemoveImage} style={{ backgroundColor: '#7B4DFF', borderRadius: 16, padding: 4 }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', marginLeft: 8 }}>Image selected</Text>
            </View>
          )}
          {/* Persisted image display */}
          {persistedImageUrl && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 8 }}>
              <Image source={{ uri: persistedImageUrl }} style={{ width: 60, height: 60, borderRadius: 10, marginRight: 8, borderWidth: 2, borderColor: '#FFD700' }} />
              <Text style={{ color: '#FFD700', marginLeft: 8 }}>Last generated image</Text>
            </View>
          )}
          {/* Show messages like chat bubbles */}
          <ScrollView contentContainerStyle={{ paddingVertical: 8 }} style={{ maxHeight: 260 }}>
            {messages.map((msg, idx) => (
              <View key={idx} style={{ marginBottom: 12, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.role === 'user' && (
                  <View style={{ backgroundColor: '#2A2D34', borderRadius: 14, padding: 10, maxWidth: '85%' }}>
                    <Text style={{ color: '#fff', fontSize: 15 }}>{msg.content}</Text>
                  </View>
                )}
                {msg.role === 'video' && (
                  <View style={{ backgroundColor: '#23242A', borderRadius: 14, padding: 10, maxWidth: '85%' }}>
                    <Text style={{ color: '#7B4DFF', fontWeight: 'bold', marginBottom: 6 }}>{msg.content}</Text>
                    {msg.videoUrl && msg.videoUrl.startsWith('http') ? (
                      <Video
                        source={{ uri: msg.videoUrl }}
                        style={{ width: 260, height: 146, borderRadius: 12, backgroundColor: '#111' }}
                        useNativeControls
                        resizeMode="contain"
                        shouldPlay={false}
                      />
                    ) : (
                      <Text style={{ color: 'red' }}>{msg.videoUrl || 'No video URL'}</Text>
                    )}
                  </View>
                )}
              </View>
            ))}
            {loading && (
              <View style={{ backgroundColor: '#23242A', borderRadius: 14, padding: 10, maxWidth: '85%', alignSelf: 'flex-start' }}>
                <Text style={{ color: '#aaa' }}>Generating video...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#23242A',
    color: '#fff',
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#7B4DFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  videoContainer: {
    backgroundColor: '#23242A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  resultLabel: {
    color: '#7B4DFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  videoUrl: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});
