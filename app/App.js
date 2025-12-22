import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  const [input, setInput] = useState("");
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
            <View style={styles.questionBox}>
              <Text style={styles.questionText}>
                How can I learn a english language quickly?
              </Text>
            </View>
            <View style={styles.answerBox}>
              <View style={styles.iconCircle}>
                <Ionicons name="flower-outline" size={32} color="#A259F7" />
              </View>
              <Text style={styles.answerText}>
                Learning a english language quickly requires effective strategies, consistency and motivation. Here are the steps you can try:
              </Text>
              <Text style={styles.stepTitle}>1. Set Clear Goals</Text>
              <Text style={styles.stepText}>
                Focus on your needs: Do you want to speak, write or understand the language fluently? Set a target time: For example, “I want to understand basic conversation in 3 months.”
              </Text>
              <Text style={styles.stepTitle}>2. Use Active Learning Techniques</Text>
              <Text style={styles.stepText}>
                Talk every day: Practice speaking even if it's just with yourself or use apps like HelloTalk or Tandem to talk to a native speaker. Write every day: Try writing a simple journal in the language.
              </Text>
            </View>
          </ScrollView>
        </View>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type here..."
            placeholderTextColor="#ccc"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.sendButton}>
            <Ionicons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
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
});
