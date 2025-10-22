import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WorkoutModal() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Ionicons name="barbell" size={64} color="#4F46E5" style={{ marginBottom: 20 }} />
      <Text style={styles.title}>Log Workout</Text>
      <Text style={styles.subtitle}>Feature coming soon!</Text>
      <Text style={styles.text}>• Select exercises from library</Text>
      <Text style={styles.text}>• Log sets, reps, and weights</Text>
      <Text style={styles.text}>• Track progress automatically</Text>
      <Text style={styles.text}>• Get PR notifications</Text>
      
      <TouchableOpacity style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#111827' },
  subtitle: { fontSize: 18, marginBottom: 30, color: '#6B7280' },
  text: { fontSize: 16, marginBottom: 12, color: '#374151', width: '100%' },
  button: { backgroundColor: '#4F46E5', padding: 16, borderRadius: 12, marginTop: 30, width: '100%' },
  buttonText: { color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: '600' },
});