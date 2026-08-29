import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';

import { createFollowUp, createGeneralQuestion, createQuery, deleteSession, transcribeAudio } from './src/api';
import { clearHistory, deleteHistoryEntry, loadHistory, saveAnswer } from './src/history';
import { defaultSettings, loadSettings, saveSettings, type AppSettings } from './src/settings';
import type { AssistantState, DocumentAnswer, HistoryEntry } from './src/types';
import { AnswerContent } from './src/AnswerContent';
import { buildGlassesCards, type GlassesCard } from './src/glasses';

const labels: Record<AssistantState, string> = {
  idle: 'Bereit', camera: 'Kamera bereit', capturing: 'Foto wird aufgenommen …', captured: 'Foto bereit', listening: 'Ich höre zu …', reviewing: 'Frage prüfen',
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
  const [recordingPurpose, setRecordingPurpose] = useState<'query' | 'followUp' | 'general'>('query');
  const [pendingTranscript, setPendingTranscript] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'assistant' | 'history' | 'settings'>('assistant');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    loadHistory().then(setHistory).catch(() => undefined);
    loadSettings().then(setSettings).catch(() => undefined);
    return () => { Speech.stop(); };
  }, []);

  async function openCamera() {
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
      setState('camera');
    } catch (cause) {
      fail(cause);
    }
  }

  async function captureDocument() {
    if (state !== 'camera') return;
    try {
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
        await submitDirectly(cleaned.uri, currentSession, true);
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

  async function startGeneralQuestion(fromReview = false) {
    if (!fromReview && state !== 'idle' && state !== 'answer' && state !== 'error') return;
    try {
      retryAction.current = null;
      setError(null);
      Speech.stop();
      if (!(await requestRecordingPermissionsAsync()).granted) {
        throw new Error('Mikrofonzugriff wurde nicht erlaubt.');
      }
      if (!fromReview) {
        if (answer) await deleteSession(currentSession).catch(() => undefined);
        setAnswer(null);
        setPhotoUri(null);
        setCurrentSession(newSessionId());
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingPurpose('general');
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
    if (state !== 'listening') return;
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
    if (!question || (recordingPurpose === 'query' && !photoUri)) return;
    setPendingTranscript('');
    const action = () => recordingPurpose === 'followUp'
      ? createFollowUp(currentSession, question)
      : recordingPurpose === 'general'
        ? createGeneralQuestion(currentSession, question)
        : createQuery(photoUri as string, currentSession, { question });
    retryAction.current = () => executeRequest(action);
    await executeRequest(action);
  }

  async function recordTranscriptAgain() {
    setPendingTranscript('');
    if (recordingPurpose === 'followUp') await startVoiceFollowUp(true);
    else if (recordingPurpose === 'general') await startGeneralQuestion(true);
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
              <View>
                <Text style={styles.eyebrow}>{state === 'idle' ? 'DEIN VISUELLER ASSISTENT' : labels[state].toUpperCase()}</Text>
                <Text style={styles.title}>{state === 'idle' ? 'AR Answer' : state === 'answer' ? 'Antwort' : 'Assistent'}</Text>
              </View>
              {state !== 'idle' ? <Pressable style={styles.iconButton} onPress={cancel} accessibilityLabel="Zurück zum Start"><Text style={styles.iconText}>×</Text></Pressable> : null}
            </View>

            {state === 'idle' && !answer && !error ? (
              <View style={styles.homeContent}>
                <Text style={styles.heroTitle}>Sehen, fragen,{`\n`}verstehen.</Text>
                <Text style={styles.heroCopy}>Fotografiere ein Dokument oder stelle eine Frage ganz ohne Kamera.</Text>
                <Pressable style={[styles.modeCard, styles.cameraModeCard]} onPress={openCamera}>
                  <View style={styles.modeIcon}><Text style={styles.modeIconText}>▣</Text></View>
                  <View style={styles.modeCopy}><Text style={styles.modeTitle}>Dokument fotografieren</Text><Text style={styles.modeDescription}>Aufgaben, Slides, Texte und Diagramme</Text></View>
                  <Text style={styles.modeArrow}>›</Text>
                </Pressable>
                <Pressable style={styles.modeCard} onPress={() => startGeneralQuestion()}>
                  <View style={[styles.modeIcon, styles.voiceModeIcon]}><Text style={styles.modeIconText}>●</Text></View>
                  <View style={styles.modeCopy}><Text style={styles.modeTitle}>Frage stellen</Text><Text style={styles.modeDescription}>Per Sprache, ganz ohne Foto</Text></View>
                  <Text style={styles.modeArrow}>›</Text>
                </Pressable>
                <View style={styles.privacyNote}><Text style={styles.privacyIcon}>◌</Text><Text style={styles.privacyText}>Aufnahmen erfolgen nur nach deiner Aktion und werden nicht im Verlauf gespeichert.</Text></View>
              </View>
            ) : null}

            {state === 'camera' || state === 'capturing' ? (
              <View style={styles.cameraWorkspace}>
                <View style={styles.cameraFrame}>
                  <CameraView ref={camera} style={styles.camera} facing="back" />
                  <View style={styles.documentGuide} pointerEvents="none">
                    <View style={[styles.guideCorner, styles.guideTopLeft]} /><View style={[styles.guideCorner, styles.guideTopRight]} />
                    <View style={[styles.guideCorner, styles.guideBottomLeft]} /><View style={[styles.guideCorner, styles.guideBottomRight]} />
                    <Text style={styles.guideText}>Dokument vollständig im Rahmen halten</Text>
                  </View>
                  <View style={styles.captureBadge}><View style={[styles.dot, state === 'capturing' && styles.dotActive]} /><Text style={styles.captureText}>AUFNAHME NUR PER TASTE</Text></View>
                </View>
                {state === 'capturing' ? <View style={styles.loading}><ActivityIndicator color="#70ff9b" /><Text style={styles.muted}>{labels[state]}</Text></View> : (
                  <Pressable style={styles.shutterButton} onPress={captureDocument}><View style={styles.shutterInner} /></Pressable>
                )}
              </View>
            ) : null}

            {state === 'captured' && photoUri ? (
              <View style={styles.previewWorkspace}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
                <Text style={styles.sectionLabel}>MIT DIESEM FOTO</Text>
                <Pressable style={styles.primaryButton} onPress={() => submitDirectly()}><Text style={styles.primaryButtonText}>Aufgabe vollständig lösen</Text></Pressable>
                <Pressable style={styles.actionCard} onPress={() => submitDirectly(photoUri, currentSession, false, 'read')}>
                  <Text style={styles.actionCardIcon}>Aa</Text><View style={styles.modeCopy}><Text style={styles.actionCardTitle}>Was steht dort?</Text><Text style={styles.modeDescription}>Inhalt originalgetreu wiedergeben</Text></View>
                </Pressable>
                <Pressable style={styles.actionCard} onPress={() => startVoiceQuestion()}>
                  <Text style={[styles.actionCardIcon, styles.recordIcon]}>●</Text><View style={styles.modeCopy}><Text style={styles.actionCardTitle}>Eigene Frage stellen</Text><Text style={styles.modeDescription}>Frage zum aufgenommenen Bild</Text></View>
                </Pressable>
                <Pressable onPress={openCamera}><Text style={styles.textAction}>Foto erneut aufnehmen</Text></Pressable>
              </View>
            ) : null}

            {state === 'listening' ? (
              <View style={styles.focusCard}><View style={styles.listeningPulse}><Text style={styles.listeningDot}>●</Text></View><Text style={styles.focusTitle}>Ich höre zu</Text><Text style={styles.focusCopy}>Sprich deine Frage deutlich und beende anschließend die Aufnahme.</Text><Pressable style={[styles.primaryButton, styles.stopButton]} onPress={stopAndSubmit}><Text style={styles.primaryButtonText}>■  Frage beenden und prüfen</Text></Pressable></View>
            ) : null}

            {state === 'reviewing' ? (
              <View style={styles.transcriptPanel}><Text style={styles.sectionLabel}>TRANSKRIPT PRÜFEN</Text><Text style={styles.focusCopy}>Du kannst den erkannten Text vor dem Senden korrigieren.</Text><TextInput value={pendingTranscript} onChangeText={setPendingTranscript} multiline autoFocus style={styles.transcriptInput} accessibilityLabel="Erkannter Fragetext" /><Pressable style={styles.primaryButton} onPress={confirmTranscript} disabled={!pendingTranscript.trim()}><Text style={styles.primaryButtonText}>Frage bestätigen und senden</Text></Pressable><Pressable style={styles.secondaryButton} onPress={recordTranscriptAgain}><Text style={styles.secondaryButtonText}>Noch einmal sprechen</Text></Pressable></View>
            ) : null}

            {state === 'processing' ? <View style={styles.focusCard}><ActivityIndicator size="large" color="#70ff9b" /><Text style={styles.focusTitle}>Einen Moment</Text><Text style={styles.focusCopy}>{labels.processing}</Text></View> : null}

            {state === 'error' ? <View style={styles.errorCard}><Text style={styles.errorLabel}>ANFRAGE FEHLGESCHLAGEN</Text><Text style={styles.errorText}>{error}</Text>{retryAction.current ? <Pressable style={styles.primaryButton} onPress={() => retryAction.current?.()}><Text style={styles.primaryButtonText}>Erneut versuchen</Text></Pressable> : null}<Pressable onPress={cancel}><Text style={styles.textAction}>Zurück zum Start</Text></Pressable></View> : null}

            {state === 'answer' && answer ? (
              answer.needsRetake ? <View style={styles.retakePanel}><Text style={styles.retakeTitle}>Aufnahme nicht sicher lesbar</Text><Text style={styles.answerText}>{answer.retakeHint || answer.spokenAnswer}</Text><Text style={styles.retakePrivacy}>Dieses Foto wird nicht im Verlauf gespeichert.</Text><Pressable style={[styles.primaryButton, styles.retakeButton]} onPress={openCamera}><Text style={styles.primaryButtonText}>Foto erneut aufnehmen</Text></Pressable></View> : (
                <View style={styles.answerWorkspace}>
                  <GlassesDisplay state={state} answer={answer} error={null} />
                  <View style={styles.answerPanel}><Text style={styles.sectionLabel}>AUSFÜHRLICHE ANTWORT</Text><AnswerContent blocks={answer.blocks} fallback={answer.spokenAnswer} /><View style={styles.answerMeta}><Text style={styles.confidence}>Sicherheit {Math.round(answer.confidence * 100)} %</Text><Pressable onPress={() => speakThroughMediaOutput(answer.spokenAnswer)}><Text style={styles.speakAction}>▶ Vorlesen</Text></Pressable></View></View>
                  <View style={styles.followUpCard}><Text style={styles.sectionLabel}>FOLGEFRAGE</Text><View style={styles.followUpRow}><TextInput value={followUp} onChangeText={setFollowUp} onSubmitEditing={submitFollowUp} placeholder="Was möchtest du noch wissen?" placeholderTextColor="#758179" style={styles.input} returnKeyType="send" /><Pressable style={styles.voiceFollowUpButton} onPress={() => startVoiceFollowUp()} accessibilityLabel="Folgefrage sprechen"><Text style={styles.voiceFollowUpText}>●</Text></Pressable><Pressable style={styles.sendButton} onPress={submitFollowUp}><Text style={styles.sendText}>↑</Text></Pressable></View></View>
                  <View style={styles.answerActions}><Pressable style={styles.secondaryButton} onPress={openCamera}><Text style={styles.secondaryButtonText}>Neues Dokument</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => startGeneralQuestion()}><Text style={styles.secondaryButtonText}>Neue Frage</Text></Pressable></View>
                  <Pressable onPress={cancel}><Text style={styles.destructiveAction}>{photoUri ? 'Bild und Kontext löschen' : 'Sitzungskontext löschen'}</Text></Pressable>
                </View>
              )
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : activeTab === 'history' ? (
        <HistoryScreen entries={history} selected={selectedHistoryEntry} onSelect={setSelectedHistoryEntry} onDelete={async (createdAt) => { await deleteHistoryEntry(createdAt); setHistory(await loadHistory()); setSelectedHistoryEntry(null); }} onClear={async () => { await clearHistory(); setHistory([]); setSelectedHistoryEntry(null); }} />
      ) : (
        <SettingsScreen settings={settings} updateSetting={updateSetting} />
      )}

      <View style={styles.tabBar}>
        <Pressable style={styles.tabButton} onPress={() => setActiveTab('assistant')}>
          <Text style={[styles.tabIcon, activeTab === 'assistant' && styles.tabActive]}>◇</Text>
          <Text style={[styles.tabLabel, activeTab === 'assistant' && styles.tabActive]}>Assistent</Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setActiveTab('history')}>
          <Text style={[styles.tabIcon, activeTab === 'history' && styles.tabActive]}>▤</Text>
          <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabActive]}>Verlauf</Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabActive]}>⚙</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabActive]}>Einstellungen</Text>
        </Pressable>
      </View>

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
  const cards = useMemo(() => answer ? buildGlassesCards(answer) : [], [answer]);
  const [cardIndex, setCardIndex] = useState(0);
  const touchStartX = useRef(0);
  const longPressed = useRef(false);

  useEffect(() => setCardIndex(0), [answer?.queryId]);

  function previousCard() {
    setCardIndex((current) => Math.max(0, current - 1));
  }

  function nextCard() {
    setCardIndex((current) => Math.min(cards.length - 1, current + 1));
  }

  const card = cards[cardIndex];
  return (
    <View style={styles.glassesArea}>
      <Pressable
        style={styles.glasses}
        onTouchStart={(event) => { touchStartX.current = event.nativeEvent.pageX; longPressed.current = false; }}
        onTouchEnd={(event) => {
          if (longPressed.current) return;
          const distance = event.nativeEvent.pageX - touchStartX.current;
          if (distance > 35) previousCard();
          else nextCard();
        }}
        onLongPress={() => { longPressed.current = true; setCardIndex(0); }}
        accessibilityLabel="Simuliertes Brillendisplay. Tippen für nächste Karte, nach rechts wischen für zurück."
      >
        <View style={styles.displayHeader}><Text style={styles.displayLabel}>BRILLENDISPLAY · {card?.title || 'STATUS'}</Text>{cards.length > 1 ? <Text style={styles.displayProgress}>{cardIndex + 1} / {cards.length}</Text> : null}</View>
        {error ? <Text style={styles.displayAnswer}>{error}</Text> : answer && state === 'answer' && card ? <GlassesCardContent card={card} /> : <Text style={styles.displayAnswer}>{labels[state]}</Text>}
      </Pressable>
      {cards.length > 1 ? <View style={styles.displayNav}><Pressable onPress={previousCard} disabled={cardIndex === 0}><Text style={[styles.displayNavText, cardIndex === 0 && styles.displayNavDisabled]}>‹ Zurück</Text></Pressable><Text style={styles.displayNavHint}>Tippen oder wischen</Text><Pressable onPress={nextCard} disabled={cardIndex === cards.length - 1}><Text style={[styles.displayNavText, cardIndex === cards.length - 1 && styles.displayNavDisabled]}>Weiter ›</Text></Pressable></View> : null}
    </View>
  );
}

function GlassesCardContent({ card }: { card: GlassesCard }) {
  if (card.type === 'summary') return <View><Text style={styles.displayAnswer}>{card.text}</Text>{card.nextHint ? <Text style={styles.displayHint}>{card.nextHint}  ›</Text> : null}</View>;
  if (card.type === 'math') return <AnswerContent blocks={[card.block]} fallback="" compact />;
  if (card.type === 'note') return <Text style={styles.displayEvidence}>{card.text}</Text>;
  return (
    <View style={styles.displayCode}>
      {card.lines.map((line, index) => (
        <View style={styles.displayCodeRow} key={`${line.sourceLine}-${index}`}>
          <Text style={styles.displayLineNumber}>{line.continuation ? '↳' : String(line.sourceLine).padStart(2, '0')}</Text>
          <Text style={styles.displayCodeText}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}

function HistoryScreen({ entries, selected, onSelect, onDelete, onClear }: {
  entries: HistoryEntry[];
  selected: HistoryEntry | null;
  onSelect: (entry: HistoryEntry | null) => void;
  onDelete: (createdAt: string) => void;
  onClear: () => void;
}) {
  if (selected) {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.historyList}>
        <Pressable onPress={() => onSelect(null)}><Text style={styles.backAction}>‹ Verlauf</Text></Pressable>
        <Text style={styles.eyebrow}>GESPEICHERTE ANTWORT</Text>
        <Text style={styles.historyDetailQuestion}>{selected.question}</Text>
        <View style={styles.answerPanel}><AnswerContent blocks={selected.blocks} fallback={selected.spokenAnswer} /></View>
        <Pressable onPress={() => speakThroughMediaOutput(selected.spokenAnswer)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Antwort vorlesen</Text></Pressable>
        <Pressable onPress={() => Alert.alert('Eintrag löschen?', 'Das lässt sich nicht rückgängig machen.', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: () => onDelete(selected.createdAt) }])}><Text style={styles.destructiveAction}>Eintrag löschen</Text></Pressable>
      </ScrollView>
    );
  }
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.historyList}>
      <Text style={styles.eyebrow}>AR ANSWER</Text><Text style={styles.title}>Verlauf</Text>
      <View style={styles.historyPrivacy}><Text style={styles.historyPrivacyTitle}>Nur lokal auf diesem Gerät</Text><Text style={styles.historyPrivacyText}>Gespeichert werden Frage und Antwort – niemals das Foto.</Text></View>
      {entries.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>Noch keine Antworten</Text><Text style={styles.muted}>Deine gespeicherten Ergebnisse erscheinen hier.</Text></View> : entries.map((entry, index) => (
        <Pressable style={styles.historyEntry} key={`${entry.createdAt}-${index}`} onPress={() => onSelect(entry)}>
          <Text style={styles.historyQuestion}>{entry.question}</Text><Text style={styles.historyAnswer} numberOfLines={3}>{entry.shortAnswer}</Text><Text style={styles.historyOpen}>Antwort öffnen  ›</Text>
        </Pressable>
      ))}
      {entries.length ? <Pressable onPress={() => Alert.alert('Verlauf löschen?', 'Fotos werden ohnehin nicht gespeichert.', [{ text: 'Abbrechen' }, { text: 'Löschen', style: 'destructive', onPress: onClear }])}><Text style={styles.deleteHistory}>Gesamten Verlauf löschen</Text></Pressable> : null}
    </ScrollView>
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
  glassesArea: { gap: 9 }, glasses: { minHeight: 220, borderRadius: 28, borderWidth: 2, borderColor: '#45ee7b', backgroundColor: '#06140b', padding: 20, gap: 18, justifyContent: 'center', shadowColor: '#45ee7b', shadowOpacity: 0.16, shadowRadius: 18 },
  displayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, displayLabel: { color: '#3e9b5c', fontSize: 9, letterSpacing: 1.2, fontWeight: '800' }, displayProgress: { color: '#70ff9b', fontSize: 10, fontWeight: '900' }, displayAnswer: { color: '#70ff9b', fontSize: 23, lineHeight: 29, fontWeight: '700' },
  displayEvidence: { color: '#a7ffbf', fontSize: 15, lineHeight: 20, marginTop: 13 }, displayHint: { color: '#ffda77', fontSize: 14, marginTop: 11 },
  displayCode: { gap: 3 }, displayCodeRow: { flexDirection: 'row', gap: 7 }, displayLineNumber: { width: 20, color: '#438f5a', fontFamily: 'monospace', fontSize: 11, lineHeight: 17, textAlign: 'right' }, displayCodeText: { flex: 1, color: '#aaffbf', fontFamily: 'monospace', fontSize: 11, lineHeight: 17 }, displayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }, displayNavText: { color: '#70ff9b', fontSize: 12, fontWeight: '800', padding: 7 }, displayNavDisabled: { color: '#35463b' }, displayNavHint: { color: '#5e7065', fontSize: 10 },
  primaryButton: { backgroundColor: '#55ed80', minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, stopButton: { backgroundColor: '#ff686d' }, retakeButton: { backgroundColor: '#ffda77' }, primaryButtonText: { color: '#07100c', fontSize: 16, fontWeight: '800' },
  mainActions: { gap: 11 },
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
  homeContent: { gap: 14, paddingTop: 20 }, heroTitle: { color: '#f4fff7', fontSize: 42, lineHeight: 47, fontWeight: '900', letterSpacing: -1.2 }, heroCopy: { color: '#91a298', fontSize: 16, lineHeight: 24, marginBottom: 14, maxWidth: 330 },
  modeCard: { minHeight: 104, borderRadius: 24, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111b15', borderWidth: 1, borderColor: '#26372d' }, cameraModeCard: { backgroundColor: '#12241a', borderColor: '#31553e' }, modeIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#254333', alignItems: 'center', justifyContent: 'center' }, voiceModeIcon: { backgroundColor: '#332329' }, modeIconText: { color: '#75f89a', fontSize: 22, fontWeight: '900' }, modeCopy: { flex: 1 }, modeTitle: { color: '#f0faf3', fontSize: 17, fontWeight: '800' }, modeDescription: { color: '#899990', fontSize: 12, lineHeight: 18, marginTop: 4 }, modeArrow: { color: '#668072', fontSize: 30, fontWeight: '300' },
  privacyNote: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 8 }, privacyIcon: { color: '#70ff9b', fontSize: 17 }, privacyText: { flex: 1, color: '#687a70', fontSize: 11, lineHeight: 17 },
  cameraWorkspace: { gap: 18 }, shutterButton: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, borderColor: '#eaf8ee', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#f3fff7' },
  previewWorkspace: { gap: 12 }, previewImage: { width: '100%', height: 250, borderRadius: 24, backgroundColor: '#111' }, sectionLabel: { color: '#70ff9b', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, actionCard: { minHeight: 70, borderRadius: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111d16', borderWidth: 1, borderColor: '#293b30' }, actionCardIcon: { width: 30, color: '#70ff9b', fontSize: 18, fontWeight: '900' }, recordIcon: { color: '#ff7176' }, actionCardTitle: { color: '#effaf2', fontSize: 15, fontWeight: '800' }, textAction: { color: '#9fb0a6', fontSize: 14, fontWeight: '700', textAlign: 'center', padding: 12 },
  focusCard: { minHeight: 330, borderRadius: 28, backgroundColor: '#101b14', borderWidth: 1, borderColor: '#26372d', padding: 24, gap: 14, alignItems: 'center', justifyContent: 'center' }, listeningPulse: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#32191d', borderWidth: 1, borderColor: '#6d3037', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, listeningDot: { color: '#ff646b', fontSize: 32 }, focusTitle: { color: '#f3fff7', fontSize: 27, fontWeight: '900' }, focusCopy: { color: '#92a299', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 310 },
  errorCard: { borderRadius: 24, backgroundColor: '#251517', borderWidth: 1, borderColor: '#653237', padding: 20, gap: 15 }, errorLabel: { color: '#ff7a80', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 }, errorText: { color: '#f4e8e9', fontSize: 17, lineHeight: 25 },
  answerWorkspace: { gap: 15 }, answerMeta: { borderTopWidth: 1, borderTopColor: '#293930', paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, speakAction: { color: '#70ff9b', fontSize: 13, fontWeight: '800' }, followUpCard: { borderRadius: 20, backgroundColor: '#0d1812', borderWidth: 1, borderColor: '#26372d', padding: 15, gap: 11 }, answerActions: { flexDirection: 'row', gap: 10 }, destructiveAction: { color: '#d9787d', fontSize: 13, fontWeight: '700', textAlign: 'center', padding: 12 },
  backAction: { color: '#70ff9b', fontSize: 16, fontWeight: '800', paddingVertical: 5 }, historyDetailQuestion: { color: '#f3fff7', fontSize: 25, lineHeight: 32, fontWeight: '900' }, historyOpen: { color: '#70ff9b', fontSize: 12, fontWeight: '800', paddingTop: 5 }, emptyState: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 8 }, emptyTitle: { color: '#effaf2', fontSize: 20, fontWeight: '800' },
});
