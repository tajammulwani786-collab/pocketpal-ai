/**
 * MOOSA PRO 8D — Home / Mission Dashboard (lightweight v1, by Muse).
 *
 * A futuristic dark-blue dashboard designed for a 6 GB RAM phone:
 * - Central glowing robot avatar drawn with react-native-svg (2D,
 *   no heavy graphics). A single native-driver pulse animation runs
 *   on transform/opacity only, so it does not slow the phone.
 * - The avatar reacts to the app's REAL voice state: while MOOSA is
 *   speaking (ttsStore playback), the pulse speeds up and the mouth
 *   bar animates.
 * - "Voice suno" button speaks a status line through the app's real
 *   on-device TTS (ttsStore.play). If TTS is not set up, it no-ops
 *   safely and the screen says so.
 * - "Permission test" button triggers the REAL AlertPermissionGate
 *   used by the agent core — the owner can allow or deny, exactly
 *   like a future spoken permission request. Nothing is executed.
 * - Mission card shows the last mission recorded by the Client
 *   Assistant screen (AsyncStorage), or an honest empty state.
 * - Module tiles navigate to the real screens/Pals that exist today.
 */
import React, {useEffect, useRef, useState} from 'react';
import {View, ScrollView, StyleSheet, Animated, Pressable} from 'react-native';

import {SafeAreaView} from 'react-native-safe-area-context';
import {Text, Button, Card} from 'react-native-paper';
import {observer} from 'mobx-react';
import Svg, {Circle, Rect, Line, Path} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation} from '@react-navigation/native';

import {ttsStore} from '../../store';
import {ROUTES} from '../../utils/navigationConstants';
import {AlertPermissionGate} from '../../store/moosaAdapters';
import type {Task, Tool} from '../../store/moosaCore';

const NEON = '#38BDF8';
const NEON_SOFT = 'rgba(56,189,248,0.35)';
const BG = '#050B1A';
const PANEL = '#0B1B33';
const TEXT_DIM = '#94A3B8';

const STATUS_LINE =
  'Assalam o Alaikum Sir. I am MOOSA, your personal A I agent. I am ready to help with your clients, business and learning.';

const MODULES: {label: string; sub: string; route: string}[] = [
  {label: 'Fiverr', sub: 'Client Assistant', route: ROUTES.CLIENT_ASSISTANT},
  {label: 'Business', sub: 'Moosa Business Pal', route: ROUTES.PALS},
  {label: 'Coding', sub: 'Chat — coding help', route: ROUTES.CHAT},
  {label: 'Trading', sub: 'Trading Teacher Pal', route: ROUTES.PALS},
  {label: 'Security', sub: 'Mentor se security sawal', route: ROUTES.CHAT},
  {label: 'Learning', sub: 'English Teacher Pal', route: ROUTES.PALS},
];

interface LastMission {
  title: string;
  at: string;
}

const RobotAvatar: React.FC<{speaking: boolean}> = ({speaking}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);

  // Pulse: gentle when idle, faster while MOOSA is speaking.
  useEffect(() => {
    const duration = speaking ? 620 : 1700;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {toValue: 1, duration, useNativeDriver: true}),
        Animated.timing(pulse, {toValue: 0, duration, useNativeDriver: true}),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, speaking]);

  // Slow rotating dashed ring — the "alive / thinking" halo.
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, {toValue: 1, duration: 14000, useNativeDriver: true}),
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);

  // Blink every few seconds (cheap state toggle, SVG-only re-render).
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3400);
    return () => clearInterval(id);
  }, []);

  const ringScale = pulse.interpolate({inputRange: [0, 1], outputRange: [1, 1.13]});
  const ringOpacity = pulse.interpolate({inputRange: [0, 1], outputRange: [0.8, 0.2]});
  const mouthScale = pulse.interpolate({inputRange: [0, 1], outputRange: [0.5, 1]});
  const spinDeg = spin.interpolate({inputRange: [0, 1], outputRange: ['0deg', '360deg']});

  return (
    <View style={styles.avatarWrap}>
      <Animated.View
        style={[styles.ring, {transform: [{scale: ringScale}], opacity: ringOpacity}]}
      />
      <Animated.View
        style={[styles.dashRing, {transform: [{rotate: spinDeg}]}]}
      />
      <Svg width={160} height={160} viewBox="0 0 160 160">
        {/* antenna */}
        <Line x1={80} y1={10} x2={80} y2={26} stroke="#E2E8F0" strokeWidth={4} />
        <Circle cx={80} cy={9} r={5.5} fill={NEON} />
        {/* white robot shell */}
        <Rect x={28} y={26} width={104} height={96} rx={30} fill="#F1F5F9" stroke="#CBD5E1" strokeWidth={2} />
        {/* ear pods */}
        <Rect x={16} y={62} width={10} height={28} rx={5} fill="#E2E8F0" stroke="#CBD5E1" strokeWidth={1.5} />
        <Rect x={134} y={62} width={10} height={28} rx={5} fill="#E2E8F0" stroke="#CBD5E1" strokeWidth={1.5} />
        {/* dark face screen */}
        <Rect x={40} y={40} width={80} height={68} rx={20} fill="#0B1B33" />
        {/* glowing cyan eyes */}
        <Circle cx={64} cy={66} r={11} fill="rgba(56,189,248,0.25)" />
        <Circle cx={96} cy={66} r={11} fill="rgba(56,189,248,0.25)" />
        <Circle cx={64} cy={66} r={6} fill={NEON} opacity={blink ? 0.25 : 1} />
        <Circle cx={96} cy={66} r={6} fill={NEON} opacity={blink ? 0.25 : 1} />
        {/* friendly smile */}
        <Path d="M 62 88 Q 80 100 98 88" stroke={NEON} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        {/* neck + shoulders hint */}
        <Rect x={68} y={124} width={24} height={8} rx={4} fill="#CBD5E1" />
        <Rect x={44} y={134} width={72} height={12} rx={6} fill="#E2E8F0" />
      </Svg>
      <Animated.View
        style={[styles.mouthBar, {transform: [{scaleX: speaking ? mouthScale : 0.45}], opacity: speaking ? 1 : 0.35}]}
      />
    </View>
  );
};

export const MoosaHomeScreen: React.FC = observer(() => {
  const navigation = useNavigation<any>();
  const speaking = ttsStore.playbackState.mode !== 'idle';
  const [mission, setMission] = useState<LastMission | null>(null);
  const [permResult, setPermResult] = useState('');
  const [voiceNote, setVoiceNote] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('Moosa.lastMission')
      .then(raw => {
        if (raw) {
          try {
            setMission(JSON.parse(raw) as LastMission);
          } catch {
            setMission(null);
          }
        }
      })
      .catch(() => {});
  }, []);

  const speakStatus = () => {
    if (!ttsStore.isTTSAvailable) {
      setVoiceNote(
        'Voice abhi setup nahi hai. Pehle Chat me kisi jawab ka play button dabakar TTS setup mukammal karo.',
      );
      return;
    }
    setVoiceNote('');
    ttsStore.play('moosa-home-status', STATUS_LINE).catch(() => {});
  };

  const permissionTest = async () => {
    const gate = new AlertPermissionGate();
    const task: Task = {
      id: 'dashboard-permission-demo',
      instruction:
        'Demo permission: MOOSA ek sample client message bhejna chahta hai. (Asal me kuch nahi bheja jayega.)',
      capability: 'send_message',
    };
    const tool: Tool = {
      capability: 'send_message',
      risk: 'write',
      requiresInternet: false,
      execute: async () => ({ok: true, summary: 'demo only — nothing executed'}),
    };
    const approved = await gate.approve(task, tool);
    setPermResult(
      approved
        ? 'Tum ne permission DI — asal kaam me MOOSA tab hi aage badhega jab tum aise hi Allow karoge.'
        : 'Tum ne permission NAHI di — MOOSA yahin ruk gaya. Yehi asal permission gate hai.',
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>MOOSA PRO</Text>
        <Text style={styles.tagline}>8D Personal AI Agent</Text>

        <RobotAvatar speaking={speaking} />
        <Text style={styles.speakingLabel}>
          {speaking ? 'MOOSA bol raha hai…' : 'MOOSA tayyar hai'}
        </Text>

        <Text style={styles.greeting}>
          Assalam o Alaikum, Sir. Main MOOSA hoon — aap ka personal AI agent.
        </Text>

        <View style={styles.btnRow}>
          <Button
            mode="contained"
            buttonColor="#0369A1"
            textColor="#E0F2FE"
            onPress={speakStatus}
            style={styles.btn}>
            Voice suno
          </Button>
          <Button
            mode="outlined"
            textColor={NEON}
            style={styles.btn}
            onPress={permissionTest}>
            Permission test
          </Button>
        </View>
        {voiceNote !== '' && <Text style={styles.note}>{voiceNote}</Text>}
        {permResult !== '' && <Text style={styles.note}>{permResult}</Text>}

        <Card style={styles.card}>
          <Card.Title title="Mission" titleStyle={styles.cardTitle} />
          <Card.Content>
            {mission ? (
              <Text style={styles.cardText}>
                Aakhri mission: {mission.title}
                {'\n'}
                Waqt: {new Date(mission.at).toLocaleString()}
              </Text>
            ) : (
              <Text style={styles.cardText}>
                Abhi koi mission record nahi hai. Client Assistant se pehla
                client message analyze karo — wo yahan nazar ayega.
              </Text>
            )}
          </Card.Content>
        </Card>

        <Text style={styles.modulesHeading}>Modules</Text>
        <View style={styles.grid}>
          {MODULES.map(m => (
            <Pressable
              key={m.label}
              style={styles.tile}
              onPress={() => navigation.navigate(m.route)}>
              <Text style={styles.tileLabel}>{m.label}</Text>
              <Text style={styles.tileSub}>{m.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>
          Har action se pehle MOOSA permission maangega. Banking apps
          hamesha band hain.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: BG},
  content: {padding: 20, paddingBottom: 36, alignItems: 'center'},
  brand: {
    color: '#E0F2FE',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
  },
  tagline: {color: NEON, fontSize: 13, letterSpacing: 2, textAlign: 'center'},
  avatarWrap: {
    width: 190,
    height: 190,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 182,
    height: 182,
    borderRadius: 91,
    borderWidth: 2,
    borderColor: NEON,
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  dashRing: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(56,189,248,0.45)',
  },
  mouthBar: {
    position: 'absolute',
    bottom: 6,
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: NEON,
  },
  speakingLabel: {color: NEON, fontSize: 13, marginTop: 2},
  greeting: {
    color: '#E2E8F0',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  btnRow: {flexDirection: 'row', gap: 10, marginTop: 16},
  btn: {flex: 1},
  note: {color: TEXT_DIM, fontSize: 13, textAlign: 'center', marginTop: 10},
  card: {backgroundColor: PANEL, width: '100%', marginTop: 20},
  cardTitle: {color: '#E0F2FE'},
  cardText: {color: '#CBD5E1', lineHeight: 20},
  modulesHeading: {
    color: '#E0F2FE',
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: 22,
    marginBottom: 10,
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%'},
  tile: {
    width: '48%',
    backgroundColor: PANEL,
    borderColor: 'rgba(56,189,248,0.4)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  tileLabel: {color: '#E0F2FE', fontSize: 16, fontWeight: '600'},
  tileSub: {color: TEXT_DIM, fontSize: 12, marginTop: 3},
  footer: {color: TEXT_DIM, fontSize: 12, textAlign: 'center', marginTop: 22},
});

export default MoosaHomeScreen;
