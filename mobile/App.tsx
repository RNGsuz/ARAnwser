import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

import { createFollowUp, createQuery, deleteSession, transcribeAudio } from './src/api';
import { clearHistory, deleteHistoryEntry, loadHistory, saveAnswer } from './src/history';
import { defaultSettings, loadSettings, saveSettings, type AppSettings } from './src/settings';
import type { AssistantState, DocumentAnswer, HistoryEntry } from './src/types';

const labels: Record<AssistantState, string> = {
  idle: 'Bereit', capturing: 'Foto wird aufgenommen …', captured: 'Foto bereit', listening: 'Ich höre zu …', reviewing: 'Frage prüfen',
  processing: 'Anfrage wird verarbeitet …', answer: 'Antwort bereit', error: 'Fehler',
};

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function speakThroughMediaOutput(text: string): Promise<void> {
  Speech.stop();
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  Speech.speak(text, { language: 'de-DE', rate: 0.95 });
}

export default function App() {
  const camera = useRef<CameraView>(null);
  const requestActive = useRef(false);
  const retryAction = useRef<(() => Promise<void>) | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [state, setState] = useState<AssistantState>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [answer, setAnswer] = useState<DocumentAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState(newSessionId());
  const [followUp, setFollowUp] = useState('');
  const [recordingPurpose, setRecordingPurpose] = useState<'query' | 'followUp'>('query');
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'settings'>('assistant');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    loadHistory().then(setHistory).catch(() => undefined);
    loadSettings().then(setSettings).catch(() => undefined);
    return () => { Speech.stop(); };
  }, []);

  async function captureDocument() {
    try {
      retryAction.current = null;
      setError(null);
      Speech.stop();
      if (!cameraPermission?.granted && !(await requestCameraPermission()).granted) {
        throw new Error('Kamerazugriff wurde nicht erlaubt.');
      }
      if (answer) await deleteSession(currentSession).catch(() => undefined);
      setAnswer(null);
      setPhotoUri(null);
      const nextSession = newSessionId();
      setCurrentSession(nextSession);
      setState('capturing');

      const photo = await camera.current?.takePictureAsync({ quality: 0.9, exif: false, shutterSound: true });
      if (!photo) throw new Error('Das Foto konnte nicht aufgenommen werden.');
      const cleaned = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.74, format: ImageManipulator.SaveFormat.JPEG },
      );
      setPhotoUri(cleaned.uri);
      if (settings.showChoiceAfterPhoto) {
        setState('captured');
      } else if (settings.voiceQuestionByDefault) {
        setState('captured');
        await startVoiceQuestion(cleaned.uri, true);
      } else {
        setState('captured');
        await submitDirectly(cleaned.uri, nextSession, true);
      }
    } catch (cause) {
      fail(cause);
    }
  }

  async function startVoiceQuestion(imageUri = photoUri, fromCapture = false) {
    if (!imageUri || (!fromCapture && state !== 'captured')) return;
    try {
      if (!(await requestRecordingPermissionsAsync()).granted) {
        throw new Error('Mikrofonzugriff wurde nicht erlaubt.');
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingPurpose('query');
      setState('listening');
    } catch (cause) {
      fail(cause);
    }
  }

  async function submitDirectly(
    imageUri = photoUri,
    targetSession = currentSession,
    fromCapture = false,
    mode: 'solve' | 'read' = 'solve',
  ) {
    if (!imageUri || (!fromCapture && state !== 'captured')) return;
    const action = () => createQuery(imageUri, targetSession, {
      question: mode === 'read'
        ? 'Was steht auf dem Bild? Gib den deutlich lesbaren Hauptinhalt knapp und originalgetreu wieder. Löse oder interpretiere keine Aufgabe, außer es ist zum Verständnis nötig.'
        : settings.explainSteps
          ? 'Löse die klar erkennbare Aufgabe vollständig und erkläre den Lösungsweg kurz. Zusammengehörige Unterfragen wie a), b), c) sind ein einziges Beispiel und sollen alle beantwortet werden. Frage nur dann nach einer Auswahl, wenn mehrere voneinander unabhängige Aufgaben oder Beispiele auf einer Buch- oder Arbeitsblattseite sichtbar sind; nummeriere diese dann knapp.'
          : 'Gib die knappen Antworten auf die klar erkennbare Aufgabe. Zusammengehörige Unterfragen wie a), b), c) sind ein einziges Beispiel und sollen alle beantwortet werden. Frage nur dann nach einer Auswahl, wenn mehrere voneinander unabhängige Aufgaben oder Beispiele sichtbar sind; nummeriere diese dann knapp.',
    });
    retryAction.current = () => executeRequest(action);
    await executeRequest(action);
  }

  async function stopAndSubmit() {
    if (state !== 'listening' || !photoUri) return;
    try {
      await recorder.stop();
      if (!recorder.uri) throw new Error('Keine Spracheingabe aufgenommen.');
      const audioUri = recorder.uri;
      retryAction.current = () => transcribeRecordedQuestion(audioUri);
      await transcribeRecordedQuestion(audioUri);
    } catch (cause) {
      fail(cause);
    }
  }

  async function transcribeRecordedQuestion(audioUri: string) {
    if (requestActive.current) return;
    requestActive.current = true;
    try {
      setError(null);
      setState('processing');
      setPendingTranscript(await transcribeAudio(audioUri));
      retryAction.current = null;
      setState('reviewing');
    } catch (cause) {
      fail(cause);
    } finally {
      requestActive.current = false;
    }
  }

  async function confirmTranscript() {
    const question = pendingTranscript.trim();
    if (!question || !photoUri) return;
    setPendingTranscript('');
    const action = () => recordingPurpose === 'followUp'
      ? createFollowUp(currentSession, question)
      : createQuery(photoUri, currentSession, { question });
    retryAction.current = () => executeRequest(action);
    await executeRequest(action);
  }

  async function recordTranscriptAgain() {
    setPendingTranscript('');
    if (recordingPurpose === 'followUp') await startVoiceFollowUp(true);
    else await startVoiceQuestion(photoUri, true);
  }

  async function submitFollowUp() {
    const question = followUp.trim();
    if (!question || !answer) return;
    setFollowUp('');
    const action = () => createFollowUp(currentSession, question);
    retryAction.current = () => executeRequest(action);
    await executeRequest(action);
  }

  async function executeRequest(action: () => Promise<DocumentAnswer>) {
    if (requestActive.current) return;
    requestActive.current = true;
    try {
      setError(null);
      setState('processing');
      await acceptAnswer(await action());
    } catch (cause) {
      fail(cause);
    } finally {
      requestActive.current = false;
    }
  }

  async function startVoiceFollowUp(fromReview = false) {
    if (!answer || (!fromReview && state !== 'answer')) return;
    try {
      Speech.stop();
      if (!(await requestRecordingPermissionsAsync()).granted) {
        throw new Error('Mikrofonzugriff wurde nicht erlaubt.');
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingPurpose('followUp');
      setState('listening');
    } catch (cause) {
      fail(cause);
    }
  }

  async function acceptAnswer(result: DocumentAnswer) {
    retryAction.current = null;
    setAnswer(result);
    setCurrentSession(result.sessionId);
    setState('answer');
    if (settings.saveHistory && !result.needsRetake) {
      await saveAnswer(result);
      setHistory(await loadHistory());
    }
    if (settings.speakAnswers) {
      await speakThroughMediaOutput(result.spokenAnswer);
    }
  }

  async function cancel() {
    Speech.stop();
    if (recorder.isRecording) await recorder.stop().catch(() => undefined);
    if (answer) await deleteSession(currentSession).catch(() => undefined);
    setState('idle');
    setAnswer(null);
    setPhotoUri(null);
    setError(null);
    setPendingTranscript('');
    retryAction.current = null;
    setCurrentSession(newSessionId());
  }

  function fail(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Unbekannter Fehler.');
    setState('error');
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next).catch(() => undefined);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {activeTab === 'assistant' ? (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View><Text style={styles.eyebrow}>DISPLAY-GLASSES PROTOTYP</Text><Text style={styles.title}>AR Answer</Text></View>
            <Pressable style={styles.iconButton} onPress={() => setHistoryVisible(true)} accessibilityLabel="Verlauf öffnen"><Text style={styles.iconText}>↺</Text></Pressable>
          </View>

          <View style={styles.cameraFrame}>
            {photoUri ? <Image source={{ uri: photoUri }} style={styles.camera} resizeMode="cover" /> : <CameraView ref={camera} style={styles.camera} facing="back" />}
            {!photoUri ? (
              <View style={styles.documentGuide} pointerEvents="none">
                <View style={[styles.guideCorner, styles.guideTopLeft]} />
                <View style={[styles.guideCorner, styles.guideTopRight]} />
                <View style={[styles.guideCorner, styles.guideBottomLeft]} />
                <View style={[styles.guideCorner, styles.guideBottomRight]} />
                <Text style={styles.guideText}>Dokument vollständig im Rahmen halten</Text>
              </View>
            ) : null}
            <View style={styles.captureBadge}>
              <View style={[styles.dot, state === 'capturing' || state === 'listening' ? styles.dotActive : null]} />
              <Text style={styles.captureText}>{state === 'listening' ? 'MIKROFON AKTIV' : 'AUFNAHME NUR PER TASTE'}</Text>
            </View>
          </View>

          <GlassesDisplay state={state} answer={answer} error={error} />

          {state === 'processing' || state === 'capturing' ? (
            <View style={styles.loading}><ActivityIndicator color="#70ff9b" /><Text style={styles.muted}>{labels[state]}</Text></View>
          ) : state === 'listening' ? (
            <Pressable style={[styles.primaryButton, styles.stopButton]} onPress={stopAndSubmit} onLongPress={cancel}><Text style={styles.primaryButtonText}>■  Frage beenden und prüfen</Text></Pressable>
          ) : state === 'reviewing' ? (
            <View style={styles.transcriptPanel}>
              <Text style={styles.transcriptLabel}>So wurde deine Frage verstanden</Text>
              <TextInput
                value={pendingTranscript}
                onChangeText={setPendingTranscript}
                multiline
                autoFocus
                style={styles.transcriptInput}
                accessibilityLabel="Erkannter Fragetext"
              />
              <Pressable style={styles.primaryButton} onPress={confirmTranscript} disabled={!pendingTranscript.trim()}>
                <Text style={styles.primaryButtonText}>Frage bestätigen und senden</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={recordTranscriptAgain} onLongPress={cancel}>
                <Text style={styles.secondaryButtonText}>Noch einmal sprechen</Text>
              </Pressable>
            </View>
          ) : state === 'captured' ? (
            <View style={styles.choicePanel}>
              <Text style={styles.choiceTitle}>Was möchtest du tun?</Text>
              <Pressable style={styles.primaryButton} onPress={() => submitDirectly()} onLongPress={cancel}><Text style={styles.primaryButtonText}>Aufgabe direkt beantworten</Text></Pressable>
              <Pressable style={styles.quickReadButton} onPress={() => submitDirectly(photoUri, currentSession, false, 'read')} onLongPress={cancel}>
                <Text style={styles.quickReadIcon}>Aa</Text>
                <View style={styles.quickReadCopy}>
                  <Text style={styles.quickReadTitle}>Was steht dort?</Text>
                  <Text style={styles.quickReadDescription}>Sichtbaren Inhalt kurz wiedergeben</Text>
                </View>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => startVoiceQuestion()} onLongPress={cancel}><Text style={styles.secondaryButtonText}>Eigene Frage sprechen</Text></Pressable>
            </View>
          ) : state === 'error' && retryAction.current ? (
            <Pressable style={styles.primaryButton} onPress={() => retryAction.current?.()} onLongPress={cancel}>
              <Text style={styles.primaryButtonText}>↻  Anfrage erneut versuchen</Text>
            </Pressable>
          ) : answer?.needsRetake ? (
            <Pressable style={[styles.primaryButton, styles.retakeButton]} onPress={captureDocument} onLongPress={cancel}>
              <Text style={styles.primaryButtonText}>↻  Foto erneut aufnehmen</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryButton} onPress={captureDocument} onLongPress={cancel}><Text style={styles.primaryButtonText}>{answer || error ? 'Neue Aufnahme' : 'Foto aufnehmen'}</Text></Pressable>
          )}

          {answer ? (
            answer.needsRetake ? (
              <View style={styles.retakePanel}>
                <Text style={styles.retakeTitle}>Aufnahme nicht sicher lesbar</Text>
                <Text style={styles.answerText}>{answer.retakeHint || answer.spokenAnswer}</Text>
                <Text style={styles.retakePrivacy}>Dieses Foto wird nicht im Verlauf gespeichert.</Text>
              </View>
            ) : (
              <View style={styles.answerPanel}>
                <Text style={styles.answerText}>{answer.spokenAnswer}</Text>
                <Text style={styles.confidence}>Sicherheit: {Math.round(answer.confidence * 100)} %</Text>
                <View style={styles.followUpRow}>
                  <TextInput value={followUp} onChangeText={setFollowUp} onSubmitEditing={submitFollowUp} placeholder="Folgefrage zum selben Bild" placeholderTextColor="#758179" style={styles.input} returnKeyType="send" />
                  <Pressable style={styles.voiceFollowUpButton} onPress={() => startVoiceFollowUp()} accessibilityLabel="Folgefrage sprechen"><Text style={styles.voiceFollowUpText}>●</Text></Pressable>
                  <Pressable style={styles.sendButton} onPress={submitFollowUp}><Text style={styles.sendText}>↑</Text></Pressable>
                </View>
              </View>
            )
          ) : null}
          {state !== 'idle' ? <Pressable onPress={cancel} onLongPress={cancel}><Text style={styles.cancel}>{answer ? 'Bild und Sitzungskontext löschen' : 'Sitzung verwerfen'}</Text></Pressable> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      ) : (
        <SettingsScreen settings={settings} updateSetting={updateSetting} />
      )}

      <View style={styles.tabBar}>
        <Pressable style={styles.tabButton} onPress={() => setActiveTab('assistant')}>
          <Text style={[styles.tabIcon, activeTab === 'assistant' && styles.tabActive]}>◉</Text>
          <Text style={[styles.tabLabel, activeTab === 'assistant' && styles.tabActive]}>Assistent</Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabActive]}>⚙</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabActive]}>Einstellungen</Text>
        </Pressable>
      </View>

      <HistoryModal visible={historyVisible} entries={history} onClose={() => setHistoryVisible(false)} onDelete={async (createdAt) => {
        await deleteHistoryEntry(createdAt); setHistory(await loadHistory());
      }} onClear={async () => {
        await clearHistory(); setHistory([]); setHistoryVisible(false);
      }} />
    </SafeAreaView>
  );
}

function SettingsScreen({ settings, updateSetting }: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.settingsContent}>
      <Text style={styles.eyebrow}>AR ANSWER</Text>
      <Text style={styles.title}>Einstellungen</Text>
      <Text style={styles.settingsIntro}>Lege fest, was nach einer Aufnahme automatisch passiert.</Text>

      <View style={styles.settingsGroup}>
        <Text style={styles.groupTitle}>Ablauf</Text>
        <SettingRow
          title="Auswahl nach Foto anzeigen"
          description="Zeigt die Wahl zwischen direkter Antwort und eigener Sprachfrage."
          value={settings.showChoiceAfterPhoto}
          onValueChange={(value) => updateSetting('showChoiceAfterPhoto', value)}
        />
        <SettingRow
          title="Sprachfrage als Standard"
          description="Wenn die Auswahl aus ist, startet nach dem Foto automatisch das Mikrofon."
          value={settings.voiceQuestionByDefault}
          disabled={settings.showChoiceAfterPhoto}
          onValueChange={(value) => updateSetting('voiceQuestionByDefault', value)}
        />
      </View>

      <View style={styles.settingsGroup}>
        <Text style={styles.groupTitle}>Antwort</Text>
        <SettingRow title="Antwort vorlesen" description="Gibt die ausführliche Antwort über die Handy-Lautsprecher aus." value={settings.speakAnswers} onValueChange={(value) => updateSetting('speakAnswers', value)} />
        <View style={[styles.audioOutputSetting, !settings.speakAnswers && styles.settingDisabled]}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Ausgabelautstärke</Text>
            <Text style={styles.settingDescription}>Wird über die Lauter-/Leiser-Tasten des Handys geregelt.</Text>
          </View>
          <Pressable style={styles.previewButton} onPress={() => speakThroughMediaOutput('So laut wird die nächste Antwort vorgelesen.')} disabled={!settings.speakAnswers}>
            <Text style={styles.previewButtonText}>Hörprobe</Text>
          </Pressable>
        </View>
        <SettingRow title="Lösungsweg erklären" description="Fordert bei direkten Aufgaben zusätzlich eine kurze Erklärung an." value={settings.explainSteps} onValueChange={(value) => updateSetting('explainSteps', value)} />
        <SettingRow title="Verlauf speichern" description="Speichert Frage und Antwort lokal, niemals das Foto." value={settings.saveHistory} onValueChange={(value) => updateSetting('saveHistory', value)} />
      </View>
    </ScrollView>
  );
}

function SettingRow({ title, description, value, onValueChange, disabled = false }: {
  title: string; description: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean;
}) {
  return (
    <View style={[styles.settingRow, disabled && styles.settingDisabled]}>
      <View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDescription}>{description}</Text></View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ false: '#344239', true: '#3cae61' }} thumbColor={value ? '#77ff9f' : '#b9c2bc'} />
    </View>
  );
}

function GlassesDisplay({ state, answer, error }: { state: AssistantState; answer: DocumentAnswer | null; error: string | null }) {
  return (
    <View style={styles.glasses}>
      <Text style={styles.displayLabel}>SIMULIERTES BRILLENDISPLAY</Text>
      {error ? <Text style={styles.displayAnswer}>{error}</Text> : answer && state === 'answer' ? (
        <><Text style={styles.displayAnswer}>{answer.shortAnswer}</Text>{answer.evidence[0] ? <Text style={styles.displayEvidence}>{answer.evidence[0]}</Text> : null}{answer.retakeHint ? <Text style={styles.displayHint}>Hinweis: {answer.retakeHint}</Text> : null}</>
      ) : <Text style={styles.displayAnswer}>{labels[state]}</Text>}
    </View>
  );
}

function HistoryModal({ visible, entries, onClose, onDelete, onClear }: {
  visible: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
  onDelete: (createdAt: string) => void;
  onClear: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>Verlauf</Text><Pressable onPress={onClose}><Text style={styles.modalAction}>Fertig</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.historyList}>
          <View style={styles.historyPrivacy}><Text style={styles.historyPrivacyTitle}>Nur lokal auf diesem Gerät</Text><Text style={styles.historyPrivacyText}>Gespeichert werden Frage und Antwort – niemals das Foto.</Text></View>
          {entries.length === 0 ? <Text style={styles.muted}>Noch keine Antworten gespeichert.</Text> : entries.map((entry, index) => (
            <View style={styles.historyEntry} key={`${entry.createdAt}-${index}`}>
              <Text style={styles.historyQuestion}>{entry.question}</Text>
              <Text style={styles.historyAnswer}>{entry.shortAnswer}</Text>
              <Pressable onPress={() => Alert.alert('Eintrag löschen?', 'Das lässt sich nicht rückgängig machen.', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => onDelete(entry.createdAt) }])}>
                <Text style={styles.deleteEntry}>Eintrag löschen</Text>
              </Pressable>
            </View>
          ))}
          {entries.length ? <Pressable onPress={() => Alert.alert('Verlauf löschen?', 'Fotos werden ohnehin nicht gespeichert.', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: onClear }])}><Text style={styles.deleteHistory}>Verlauf löschen</Text></Pressable> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: '#07100c' }, content: { padding: 20, paddingBottom: 48, gap: 18 },
  tabBar: { minHeight: 66, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#203027', backgroundColor: '#0b1510', paddingBottom: Platform.OS === 'android' ? 6 : 0 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, tabIcon: { color: '#718078', fontSize: 19 }, tabLabel: { color: '#718078', fontSize: 11, fontWeight: '700' }, tabActive: { color: '#70ff9b' },
  settingsContent: { padding: 20, paddingBottom: 42, gap: 8 }, settingsIntro: { color: '#93a399', fontSize: 15, lineHeight: 22, marginBottom: 18 },
  settingsGroup: { backgroundColor: '#111d16', borderRadius: 22, paddingHorizontal: 16, marginBottom: 14 }, groupTitle: { color: '#70ff9b', fontSize: 12, letterSpacing: 1.1, fontWeight: '800', paddingTop: 17, paddingBottom: 5 },
  settingRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: '#25342b' }, settingDisabled: { opacity: 0.42 }, settingCopy: { flex: 1, paddingVertical: 13 }, settingTitle: { color: '#effaf2', fontSize: 16, fontWeight: '700' }, settingDescription: { color: '#8d9d93', fontSize: 12, lineHeight: 17, marginTop: 4 },
  audioOutputSetting: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#25342b' }, previewButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#203127', alignItems: 'center', justifyContent: 'center' }, previewButtonText: { color: '#dff5e5', fontSize: 12, fontWeight: '700' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { color: '#70ff9b', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  title: { color: '#f3fff7', fontSize: 32, fontWeight: '800', marginTop: 2 }, iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#17231c', alignItems: 'center', justifyContent: 'center' }, iconText: { color: '#70ff9b', fontSize: 25 },
  cameraFrame: { height: 265, borderRadius: 26, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#27372e' }, camera: { width: '100%', height: '100%' },
  documentGuide: { position: 'absolute', left: 26, right: 26, top: 40, bottom: 28, alignItems: 'center', justifyContent: 'flex-end' }, guideCorner: { position: 'absolute', width: 28, height: 28, borderColor: 'rgba(112,255,155,0.9)' }, guideTopLeft: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3 }, guideTopRight: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3 }, guideBottomLeft: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3 }, guideBottomRight: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3 }, guideText: { color: '#effaf2', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(4,10,7,0.72)', marginBottom: 8 },
  captureBadge: { position: 'absolute', left: 12, top: 12, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(4,10,7,0.78)', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#68716b' }, dotActive: { backgroundColor: '#ff5d62' }, captureText: { color: '#d9e5dd', fontSize: 10, letterSpacing: 0.7, fontWeight: '700' },
  glasses: { minHeight: 180, borderRadius: 28, borderWidth: 2, borderColor: '#45ee7b', backgroundColor: '#06140b', padding: 21, justifyContent: 'center', shadowColor: '#45ee7b', shadowOpacity: 0.16, shadowRadius: 18 },
  displayLabel: { position: 'absolute', top: 12, left: 20, color: '#3e9b5c', fontSize: 9, letterSpacing: 1.4 }, displayAnswer: { color: '#70ff9b', fontSize: 23, lineHeight: 29, fontWeight: '700' },
  displayEvidence: { color: '#a7ffbf', fontSize: 15, lineHeight: 20, marginTop: 13 }, displayHint: { color: '#ffda77', fontSize: 14, marginTop: 11 },
  primaryButton: { backgroundColor: '#55ed80', minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, stopButton: { backgroundColor: '#ff686d' }, retakeButton: { backgroundColor: '#ffda77' }, primaryButtonText: { color: '#07100c', fontSize: 16, fontWeight: '800' },
  choicePanel: { gap: 11, padding: 14, borderRadius: 20, backgroundColor: '#101c15' }, choiceTitle: { color: '#dce9e0', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  transcriptPanel: { gap: 11, padding: 15, borderRadius: 20, backgroundColor: '#101c15', borderWidth: 1, borderColor: '#2d4938' }, transcriptLabel: { color: '#70ff9b', fontSize: 13, fontWeight: '800' }, transcriptInput: { minHeight: 86, borderRadius: 15, padding: 13, color: '#f3fff7', backgroundColor: '#07100c', borderWidth: 1, borderColor: '#3c5947', fontSize: 16, lineHeight: 23, textAlignVertical: 'top' },
  quickReadButton: { minHeight: 58, borderRadius: 18, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#1a2a21', borderWidth: 1, borderColor: '#365041' }, quickReadIcon: { color: '#70ff9b', fontSize: 18, fontWeight: '900' }, quickReadCopy: { flex: 1 }, quickReadTitle: { color: '#effaf2', fontSize: 15, fontWeight: '800' }, quickReadDescription: { color: '#8fa097', fontSize: 11, marginTop: 2 },
  secondaryButton: { minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#55ed80' }, secondaryButtonText: { color: '#70ff9b', fontSize: 16, fontWeight: '700' },
  loading: { height: 58, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' }, muted: { color: '#9aaba0', fontSize: 15 },
  answerPanel: { borderRadius: 20, backgroundColor: '#111d16', padding: 18, gap: 13 }, answerText: { color: '#e8f3eb', fontSize: 17, lineHeight: 25 }, confidence: { color: '#8da096', fontSize: 12 },
  retakePanel: { borderRadius: 20, backgroundColor: '#271f0d', borderWidth: 1, borderColor: '#8c7029', padding: 18, gap: 10 }, retakeTitle: { color: '#ffda77', fontSize: 17, fontWeight: '800' }, retakePrivacy: { color: '#a69a78', fontSize: 12 },
  followUpRow: { flexDirection: 'row', gap: 9 }, input: { flex: 1, minHeight: 50, borderRadius: 15, paddingHorizontal: 15, color: '#f3fff7', backgroundColor: '#07100c', borderWidth: 1, borderColor: '#2d4035' }, voiceFollowUpButton: { width: 50, borderRadius: 15, backgroundColor: '#203127', alignItems: 'center', justifyContent: 'center' }, voiceFollowUpText: { color: '#ff686d', fontSize: 17 }, sendButton: { width: 50, borderRadius: 15, backgroundColor: '#55ed80', alignItems: 'center', justifyContent: 'center' }, sendText: { color: '#07100c', fontSize: 24, fontWeight: '800' }, cancel: { color: '#87958c', textAlign: 'center', padding: 10 },
  modal: { flex: 1, backgroundColor: '#08110d' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#203027' }, modalTitle: { color: '#f3fff7', fontSize: 24, fontWeight: '800' }, modalAction: { color: '#70ff9b', fontSize: 16 },
  historyList: { padding: 20, gap: 12 }, historyPrivacy: { backgroundColor: '#102319', borderWidth: 1, borderColor: '#27533a', borderRadius: 16, padding: 14 }, historyPrivacyTitle: { color: '#70ff9b', fontSize: 13, fontWeight: '800' }, historyPrivacyText: { color: '#9aaba0', fontSize: 12, lineHeight: 17, marginTop: 3 }, historyEntry: { backgroundColor: '#121f17', padding: 16, borderRadius: 16, gap: 7 }, historyQuestion: { color: '#93a399', fontSize: 13 }, historyAnswer: { color: '#effaf2', fontSize: 17, fontWeight: '600' }, deleteEntry: { color: '#d78b8e', fontSize: 12, fontWeight: '700', paddingTop: 7 }, deleteHistory: { color: '#ff777b', textAlign: 'center', padding: 18 },
});
