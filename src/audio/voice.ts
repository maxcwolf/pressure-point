// The announcer's recorded lines, each matched to the text it says on the announcement banner.

import acupuncturistAtAcupuncture from '../sounds/announcer/acupuncturist-at-acupuncture.m4a';
import caretakerNeeded from '../sounds/announcer/caretaker-needed.m4a';
import chakrasAligned from '../sounds/announcer/chakras-aligned.m4a';
import clothingMandatory from '../sounds/announcer/clothing-mandatory.m4a';
import doNotTip from '../sounds/announcer/do-not-tip.m4a';
import emergencyAllHands from '../sounds/announcer/emergency-all-hands.m4a';
import emergencyFunRun from '../sounds/announcer/emergency-fun-run.m4a';
import emergencyFurniture from '../sounds/announcer/emergency-furniture.m4a';
import emergencyYoga from '../sounds/announcer/emergency-yoga.m4a';
import emotionalBaggage from '../sounds/announcer/emotional-baggage.m4a';
import faceShapedMarks from '../sounds/announcer/face-shaped-marks.m4a';
import healingCenterOpen1 from '../sounds/announcer/healing-center-open-1.m4a';
import healingCenterOpen2 from '../sounds/announcer/healing-center-open-2.m4a';
import healingCenterOpen3 from '../sounds/announcer/healing-center-open-3.m4a';
import healingCenterOpen4 from '../sounds/announcer/healing-center-open-4.m4a';
import healthInspector from '../sounds/announcer/health-inspector.m4a';
import herbalTea from '../sounds/announcer/herbal-tea.m4a';
import massageAtMassage from '../sounds/announcer/massage-at-massage.m4a';
import mercuryNotInRetrograde from '../sounds/announcer/mercury-not-in-retrograde.m4a';
import pleaseBreatheIn from '../sounds/announcer/please-breathe-in.m4a';
import powerOut from '../sounds/announcer/power-out.m4a';
import powerOutSoon from '../sounds/announcer/power-out-soon.m4a';
import qiGongAtQiGong from '../sounds/announcer/qi-gong-at-qi-gong.m4a';
import qiGongStarting from '../sounds/announcer/qi-gong-starting.m4a';
import qiGongStarting2 from '../sounds/announcer/qi-gong-starting-2.m4a';
import receptionistAtReception from '../sounds/announcer/receptionist-at-reception.m4a';
import redAura from '../sounds/announcer/red-aura.m4a';
import reikiAtReiki from '../sounds/announcer/reiki-at-reiki.m4a';
import relaxationIsMandatory from '../sounds/announcer/relaxation-is-mandatory.m4a';
import removePantsUrinal from '../sounds/announcer/remove-pants-urinal.m4a';
import screamingIntoVoid from '../sounds/announcer/screaming-into-void.m4a';
import sighingNotBreathwork from '../sounds/announcer/sighing-not-breathwork.m4a';
import springSprung from '../sounds/announcer/spring-sprung.m4a';
import stopUsingSingingBowls from '../sounds/announcer/stop-using-singing-bowls.m4a';
import stormEnded from '../sounds/announcer/storm-ended.m4a';
import stormIncoming from '../sounds/announcer/storm-incoming.m4a';
import stormStarted from '../sounds/announcer/storm-started.m4a';
import sweatShopOpen from '../sounds/announcer/sweat-shop-open.m4a';
import vipVisiting from '../sounds/announcer/vip-visiting.m4a';
import wallsNotMelting from '../sounds/announcer/walls-not-melting.m4a';
import welcomeSeekers from '../sounds/announcer/welcome-seekers.m4a';
import wellnessAtConsultation from '../sounds/announcer/wellness-at-consultation.m4a';
import winterIsHere from '../sounds/announcer/winter-is-here.m4a';

/** Each recorded announcement, by the exact text shown with it. */
export const VOICE_LINES: Readonly<Record<string, string>> = {
  'Please keep your chakras aligned and your belongings with you.': chakrasAligned,
  'Guests leaving face-shaped marks on the towels will be charged.': faceShapedMarks,
  'A reminder that relaxation is mandatory.': relaxationIsMandatory,
  'Would the owner of a red aura please move it from the fire exit.': redAura,
  'Please do not tip the therapists. They fall over.': doNotTip,
  'The herbal tea is herbal. That is all we are prepared to say.': herbalTea,
  'Please breathe in. Further instructions will follow.': pleaseBreatheIn,
  'Guests are reminded that clothing is mandatory in the hallways.': clothingMandatory,
  'Attention male visitors, please do not completely remove your pants while using the urinal.': removePantsUrinal,
  'Welcome, seekers. We remind you that enlightenment is a journey, and our gift shop accepts all major credit cards.':
    welcomeSeekers,
  'A polite reminder: Mercury is no longer in retrograde, so you have absolutely no excuse for your behavior.':
    mercuryNotInRetrograde,
  'Reminder: Screaming into the void is permitted only between the hours of two and four PM.': screamingIntoVoid,
  'Visitors are reminded that sighing heavily does not count as breathwork.': sighingNotBreathwork,
  'Staff are requested to stop using the singing bowls to mix their salad in the breakroom.': stopUsingSingingBowls,
  'Would the guest who left their emotional baggage in the hallway please return and retrieve it.': emotionalBaggage,
  'The healing center is now open. Please form an orderly line in order of your aura’s color code.': healingCenterOpen1,
  'The healing center is now open. Praise Rang!': healingCenterOpen2,
  'The healing center is now open. Please align your chakras, empty your wallets, and form an orderly line.':
    healingCenterOpen3,
  'The healing center is now open. Management requests that you leave your negative energy... and your lawyer, at the door.':
    healingCenterOpen4,
  'Receptionist needed at the Reception Desk.': receptionistAtReception,
  'Wellness Consultant needed at the Consultation Room.': wellnessAtConsultation,
  'Massage Therapist needed at the Massage Suite.': massageAtMassage,
  'Acupuncturist needed at the Acupuncture Clinic.': acupuncturistAtAcupuncture,
  'Reiki Practitioner needed at the Reiki Studio.': reikiAtReiki,
  'Qi Gong Instructor needed at the Qi Gong Studio.': qiGongAtQiGong,
  'Qi Gong is starting in the studio. Come cultivate your inner energy, because your outer energy is frankly exhausting.':
    qiGongStarting,
  'Qi Gong is now starting. If you cannot feel the invisible ball of energy between your hands, please simulate one for the comfort of others.':
    qiGongStarting2,
  'Caretaker needed. The corridors are getting gross.': caretakerNeeded,
  'The power company will be working on the lines this week. Expect a power cut.': powerOutSoon,
  'The power is out. Anything with a plug is now a very expensive ornament.': powerOut,
  'The sweat shop... I mean, sweat lodge, is now open.': sweatShopOpen,
  'A VIP will be visiting in five days. Look busy.': vipVisiting,
  'The health inspector is on the way. Hide the sage.': healthInspector,
  'A storm is coming in off the sea later this week. Batten down the hatches.': stormIncoming,
  'The storm has arrived. Please keep away from the windows... and Brent.': stormStarted,
  'The storm has passed. The seagulls are back, and so are the guests.': stormEnded,
  'Winter is here. The promenade is empty, so watch the budget until spring.': winterIsHere,
  'Spring has sprung! The first day-trippers are back in town.': springSprung,
  'Would the naked guest running through the lobby please note that the walls are not, in fact, melting.':
    wallsNotMelting,
  'Emergency incoming! A yoga retreat attempted a group pose and it went badly.': emergencyYoga,
  'Emergency incoming! The city fun run turned out to be an unfun run.': emergencyFunRun,
  'Emergency incoming! An all-hands meeting ran three hours over with no chairs.': emergencyAllHands,
  'Emergency incoming! A furniture store ran a build-it-yourself weekend.': emergencyFurniture,
};

/**
 * The recording of an announcement, if the announcer has recorded it, or has recorded the line it opens with: a season
 * starts with a recorded line and goes on with that game's numbers, read on the banner but not aloud.
 */
export function voiceFor(text: string): string | undefined {
  const opening = Object.keys(VOICE_LINES).find((line) => text.startsWith(`${line} `));
  return VOICE_LINES[text] ?? (opening && VOICE_LINES[opening]);
}
