/**
 * MOOSA Client Assistant screen (Sprint B/C wiring, written by Muse).
 *
 * The owner pastes a client message; the pure workflow in
 * src/store/moosaClientAssistant.ts produces, fully offline:
 *  - a Roman Urdu explanation of what the client is asking
 *  - a structured requirement brief
 *  - a professional English reply draft (owner reviews before use)
 *  - a phased project plan
 *  - a quality check of the draft
 * Copy and Share buttons make the result easy to reuse. Nothing is
 * sent anywhere from this screen.
 */
import React, {useState} from 'react';
import {View, ScrollView, Share, StyleSheet} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, Button, TextInput} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {useTheme} from '../../hooks';
import {
  runClientWorkflow,
  explainBriefInRomanUrdu,
  type ClientWorkflowResult,
} from '../../store/moosaClientAssistant';

export const ClientAssistantScreen: React.FC = () => {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ClientWorkflowResult | null>(null);
  const [copiedNote, setCopiedNote] = useState('');

  const analyze = () => {
    if (!message.trim()) return;
    const r = runClientWorkflow(message);
    setResult(r);
    setCopiedNote('');
    AsyncStorage.setItem(
      'Moosa.lastMission',
      JSON.stringify({
        title: `Client Assistant — ${r.brief.service}: ${r.brief.summary.slice(0, 90)}`,
        at: new Date().toISOString(),
      }),
    ).catch(() => {});
  };

  const copyText = (label: string, text: string) => {
    Clipboard.setString(text);
    setCopiedNote(`${label} copy ho gaya.`);
  };

  const shareText = async (text: string) => {
    try {
      await Share.share({message: text});
    } catch {
      // Share sheet dismissed or unavailable; nothing to report.
    }
  };

  const fullResultText = result
    ? [
        '— Client explanation (Roman Urdu) —',
        explainBriefInRomanUrdu(result.brief),
        '',
        '— Requirement brief —',
        result.brief.summary,
        '',
        '— Reply draft (English) —',
        result.replyDraft,
        '',
        '— Project plan —',
        result.plan.phases
          .map(p => `${p.name}\n${p.steps.map(s => `• ${s}`).join('\n')}`)
          .join('\n\n'),
      ].join('\n')
    : '';

  return (
    <SafeAreaView
      style={[styles.root, {backgroundColor: theme.colors.background}]}
      edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleMedium" style={styles.heading}>
          Client ka message yahan paste karo
        </Text>
        <Text variant="bodyMedium" style={styles.sub}>
          MOOSA message ko samjhega, Roman Urdu me samjhaye ga, requirements
          nikale ga, professional English reply ka draft banaye ga aur project
          plan tayyar kare ga. Sab kuch offline hota hai — message kahin
          bheja nahi jata.
        </Text>
        <TextInput
          mode="outlined"
          multiline
          numberOfLines={6}
          value={message}
          onChangeText={setMessage}
          placeholder="Client ka message yahan paste karo…"
          style={styles.input}
        />
        <Button mode="contained" onPress={analyze} style={styles.analyzeBtn}>
          Message samjho
        </Button>

        {result && (
          <>
            <Card style={styles.card}>
              <Card.Title title="Client kya keh raha hai" />
              <Card.Content>
                <Text variant="bodyMedium">
                  {explainBriefInRomanUrdu(result.brief)}
                </Text>
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Title title="Requirement brief" />
              <Card.Content>
                <Text variant="bodyMedium">{result.brief.summary}</Text>
                {result.brief.missingInfo.length > 0 && (
                  <Text variant="bodyMedium" style={styles.block}>
                    Confirm karne wali cheezen:{'\n'}
                    {result.brief.missingInfo
                      .map((q, i) => `${i + 1}. ${q}`)
                      .join('\n')}
                  </Text>
                )}
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Title title="Professional reply draft (English)" />
              <Card.Content>
                <Text variant="bodyMedium">{result.replyDraft}</Text>
              </Card.Content>
              <Card.Actions>
                <Button
                  onPress={() => copyText('Reply draft', result.replyDraft)}>
                  Copy reply
                </Button>
                <Button onPress={() => shareText(result.replyDraft)}>
                  Share
                </Button>
              </Card.Actions>
            </Card>

            <Card style={styles.card}>
              <Card.Title title="Project plan" />
              <Card.Content>
                {result.plan.phases.map(phase => (
                  <View key={phase.name} style={styles.phase}>
                    <Text variant="titleSmall">{phase.name}</Text>
                    {phase.steps.map(step => (
                      <Text key={step} variant="bodyMedium">
                        • {step}
                      </Text>
                    ))}
                  </View>
                ))}
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Title title="Quality check" />
              <Card.Content>
                {result.quality.passed.map(line => (
                  <Text key={line} variant="bodyMedium">
                    ✓ {line}
                  </Text>
                ))}
                {result.quality.warnings.map(line => (
                  <Text
                    key={line}
                    variant="bodyMedium"
                    style={{color: theme.colors.error}}>
                    ⚠ {line}
                  </Text>
                ))}
              </Card.Content>
              <Card.Actions>
                <Button onPress={() => copyText('Poora result', fullResultText)}>
                  Copy poora result
                </Button>
                <Button onPress={() => shareText(fullResultText)}>
                  Share result
                </Button>
              </Card.Actions>
            </Card>

            {copiedNote !== '' && (
              <Text variant="bodyMedium" style={styles.copied}>
                {copiedNote}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {padding: 16, paddingBottom: 32},
  heading: {marginBottom: 4},
  sub: {marginBottom: 12, opacity: 0.8},
  input: {marginBottom: 12},
  analyzeBtn: {marginBottom: 16},
  card: {marginBottom: 12},
  block: {marginTop: 8},
  phase: {marginBottom: 10},
  copied: {textAlign: 'center', marginTop: 4},
});

export default ClientAssistantScreen;
