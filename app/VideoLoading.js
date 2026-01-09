import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function VideoLoading() {
  const { prompt, fetchResultUrl, apiKey, duration } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState("");
  const [videos, setVideos] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVideoUrl, setModalVideoUrl] = useState(null);

  // Load all generated videos from backend video-history API
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://kujto-ai.onrender.com/video-history', {
          method: 'GET',
        });
        const data = await res.json();
        let videosArr = [];
        if (Array.isArray(data)) {
          videosArr = data;
        } else if (Array.isArray(data.messages)) {
          videosArr = data.messages;
        }
        // Debug log: show video URLs
        console.log('Loaded videos:', videosArr.map(v => v.video_url || v.url));
        setVideos(videosArr);
      } catch (e) {
        setVideos([]);
        console.log('Error loading videos:', e);
      }
    })();
  }, []);

  // Poll for the in-progress video
  useEffect(() => {
    let pollCount = 0;
    let maxPolls = 20;
    let pollDelay = 5000;
    let finished = false;
    let interval;

    if (!fetchResultUrl) {
      setLoading(false);
      return;
    }

    const poll = async () => {
      while (!finished && pollCount < maxPolls) {
        await new Promise(res => setTimeout(res, pollDelay));
        setProgress(Math.min(100, Math.round(((pollCount + 1) / maxPolls) * 100)));
        try {
          // Always use POST for Modelslab video fetch endpoint
          let pollRes = await fetch(fetchResultUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: apiKey })
          });
          const pollData = await pollRes.json();
          let pollUrl = pollData.video_url || pollData.videoUrl || pollData.url || (pollData.output && pollData.output[0]);
          if (pollUrl) {
            setVideoUrl(pollUrl);
            setLoading(false);
            finished = true;
            // Save to backend video-history with correct payload
            const newVideo = {
              video_url: pollUrl,
              description: prompt ? `${prompt}${duration ? ` (Duration: ${duration}s)` : ''}` : '',
            };
            try {
              await fetch('https://kujto-ai.onrender.com/video-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newVideo)
              });
            } catch (e) {}
            setVideos(prev => [
              {
                video_url: pollUrl,
                description: prompt ? `${prompt}${duration ? ` (Duration: ${duration}s)` : ''}` : '',
              },
              ...prev
            ]);
            break;
          }
          if (pollData.status && pollData.status !== 'processing') {
            setError((pollData.error && typeof pollData.error === 'string') ? pollData.error : JSON.stringify(pollData));
            setLoading(false);
            finished = true;
            break;
          }
        } catch (e) {
          let errMsg = 'Error polling for video result.';
          if (e && e.message) errMsg += ' ' + e.message;
          setError(errMsg);
          setLoading(false);
          finished = true;
          break;
        }
        pollCount++;
      }
      if (!finished) {
        setError('Video generation timed out.');
        setLoading(false);
      }
    };
    poll();
    return () => clearInterval(interval);
  }, [fetchResultUrl, apiKey]);

  return (
    <View style={styles.container}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 24, marginTop: 24 }}>Generated Videos</Text>
      <ScrollView style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 24 }}>
        {videos.length === 0 && (
          <Text style={{ color: '#aaa', textAlign: 'center', marginBottom: 16 }}>No videos generated yet.</Text>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {videos.map((vid, idx) => (
            <TouchableOpacity
              key={(vid.video_url || vid.url || idx) + idx}
              style={{ width: '48%', alignItems: 'center', marginBottom: 24, backgroundColor: '#23242A', borderRadius: 14, padding: 8 }}
              onPress={() => {
                setModalVideoUrl(vid.video_url || vid.url);
                setModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Video
                source={{ uri: vid.video_url || vid.url }}
                style={{ width: '100%', aspectRatio: 9/16, borderRadius: 12, backgroundColor: '#111' }}
                isLooping
                shouldPlay
                resizeMode="contain"
                useNativeControls={false}
                isMuted={true}
              />
              {vid.description ? (
                <Text style={{ color: '#FFD700', fontSize: 12, marginTop: 4, textAlign: 'center' }}>{vid.description}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
              {/* Modal for full-size video preview */}
              <Modal visible={modalVisible} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
                  <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 2 }} onPress={() => setModalVisible(false)}>
                    <Text style={{ color: '#FFD700', fontSize: 28, fontWeight: 'bold' }}>×</Text>
                  </TouchableOpacity>
                  {modalVideoUrl && (
                    <Video
                      source={{ uri: modalVideoUrl }}
                      style={{ width: width * 0.9, height: height * 0.8, borderRadius: 18, backgroundColor: '#111' }}
                      useNativeControls
                      resizeMode="contain"
                      shouldPlay
                      isLooping
                      isMuted={false}
                    />
                  )}
                </View>
              </Modal>
        </View>
        {/* In-progress video at the top */}
        {loading && fetchResultUrl && (
          <View style={{ alignItems: 'center', marginBottom: 24, backgroundColor: '#23242A', borderRadius: 14, padding: 16 }}>
            <ActivityIndicator size="large" color="#7B4DFF" />
            <Text style={styles.loadingText}>Generating video...</Text>
            {duration && (
              <Text style={{ color: '#FFD700', fontSize: 16, marginTop: 4 }}>Duration: {duration} sec</Text>
            )}
            <Text style={styles.progressText}>{progress}%</Text>
            <Text style={{ color: '#fff', marginTop: 8, fontSize: 15, textAlign: 'center' }}>{prompt}</Text>
          </View>
        )}
        {/* Error message if present */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181A20',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  progressText: {
    color: '#FFD700',
    fontSize: 22,
    marginTop: 8,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  resultLabel: {
    color: '#7B4DFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
});
