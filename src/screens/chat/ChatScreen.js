import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';

export default function ChatScreen({ matches, conversations, onSendMessage, selectedChatId, onSelectChat }) {
  const selectedMatch = matches.find((m) => m.id === selectedChatId);

  if (selectedMatch) {
    return (
      <ConversationView
        match={selectedMatch}
        messages={conversations[selectedMatch.id] || []}
        onSend={(text) => onSendMessage(selectedMatch.id, text)}
        onBack={() => onSelectChat(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Messages 💬</Text>

      {matches.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🌸</Text>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Match with someone to start chatting!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const thread = conversations[item.id] || [];
            const lastMessage = thread[thread.length - 1];
            return (
              <TouchableOpacity style={styles.row} onPress={() => onSelectChat(item.id)}>
                <View style={styles.avatarCircle}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarEmoji}>{item.avatar}</Text>
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {lastMessage ? lastMessage.text : 'Say hello! 👋'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function ConversationView({ match, messages, onSend, onBack }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.convoHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.convoName}>{match.name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.from === 'me' ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, item.from === 'me' && styles.bubbleTextMe]}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.convoEmpty}>You matched with {match.name}! Say hi 🌸</Text>
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input} placeholder="Type a message..."
          placeholderTextColor="#B87A68" value={text} onChangeText={setText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F0', paddingTop: 60 },
  header: { fontSize: 22, fontWeight: '700', color: '#E8603A', textAlign: 'center', marginBottom: 16 },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: '#F5C4B0',
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FDDDD4',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52 },
  avatarEmoji: { fontSize: 26 },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#3D1A0E' },
  preview: { fontSize: 13, color: '#B87A68', marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#3D1A0E', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#B87A68', textAlign: 'center' },
  convoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5C4B0',
  },
  backBtn: { width: 50 },
  backText: { fontSize: 15, color: '#E8603A', fontWeight: '600' },
  convoName: { fontSize: 17, fontWeight: '700', color: '#3D1A0E' },
  messageList: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  convoEmpty: { textAlign: 'center', color: '#B87A68', marginTop: 40, fontStyle: 'italic' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12, marginBottom: 8 },
  bubbleThem: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#F5C4B0', alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: '#E8603A', alignSelf: 'flex-end' },
  bubbleText: { fontSize: 14, color: '#3D1A0E' },
  bubbleTextMe: { color: '#fff' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#F5C4B0' },
  input: {
    flex: 1, backgroundColor: '#FEF0EA', borderWidth: 1.5, borderColor: '#F5C4B0',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#3D1A0E',
  },
  sendBtn: { backgroundColor: '#E8603A', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
