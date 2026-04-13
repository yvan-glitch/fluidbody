import { useState } from 'react';
import { Text, StyleSheet, View, TouchableOpacity, ScrollView, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Ellipse, Line, Rect } from 'react-native-svg';
import { T, PILIER_IMAGES } from '../constants/data';
import { Bulle, Rayon, FloatingMedusas, BULLES } from '../components/Meduse';

const ARTICLES = {
  fr: [
    { key: 'p1', titre: 'L\'épaule — l\'articulaire la plus libre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'L\'épaule est l\'articulation la plus mobile du corps humain. Cette liberté extraordinaire a un prix : la stabilité ne vient pas de l\'os, mais entièrement des muscles.', corps: `La coiffe des rotateurs — quatre muscles profonds — est le vrai chef d'orchestre de chaque mouvement. Quand elle est faible ou mal activée, les tensions s'installent insidieusement dans les trapèzes, le cou, parfois jusqu'aux lombaires.\n\nLe problème n'est jamais là où ça fait mal.\n\nAvant de renforcer, il faut comprendre. Sentir comment l'omoplate glisse sur la cage thoracique. Ressentir le poids du bras se déposer dans l'articulation. Laisser la tête de l'humérus s'ancrer dans la glène.\n\nC'est depuis cette conscience que naît le mouvement juste — fluide, sans effort apparent, sans douleur.`, citation: 'L\'épaule libre, c\'est une épaule qui a appris à se poser avant de s\'élever.' },
    { key: 'p2', titre: 'Le dos — pourquoi ça souffre vraiment', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Huit personnes sur dix souffriront du dos à un moment de leur vie. Pourtant, la douleur est rarement là où le problème se trouve.', corps: `La colonne vertébrale est une architecture de génie : 33 vertèbres, des dizaines de muscles, des ligaments, des disques amortisseurs. Tout est conçu pour le mouvement — pas pour l'immobilité.\n\nLe vrai ennemi du dos, c'est la sédentarité. Rester assis des heures raccourcit le psoas, déséquilibre le bassin, écrase les disques.\n\nMais le dos répond extraordinairement bien quand on lui redonne de la conscience. Sentir la respiration gonfler les côtes postérieures. Percevoir l'espace entre chaque vertèbre.\n\nLe dos ne guérit pas par le repos. Il guérit par le mouvement conscient.`, citation: 'Un dos qui souffre est un dos qui demande à être entendu.' },
    { key: 'p3', titre: 'La mobilité — la jeunesse du corps', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'On ne vieillit pas d\'abord dans la peau, mais dans les articulations. La mobilité est la mesure la plus fidèle de la jeunesse corporelle.', corps: `La hanche est le centre de gravité du corps. Quand elle se bloque, tout compense : les lombaires, les genoux, les épaules.\n\nLa mobilité ne se confond pas avec la souplesse. On peut être souple sans être mobile. La mobilité, c'est la capacité à contrôler activement une amplitude de mouvement.\n\nC'est une compétence. Elle s'acquiert, se travaille, s'entretient. Et chaque degré de liberté retrouvé dans une articulation est une invitation à habiter le corps différemment.\n\nMobiliser, c'est rajeunir.`, citation: 'La liberté de mouvement n\'est pas un luxe. C\'est une nécessité vitale.' },
    { key: 'p4', titre: 'La posture — l\'empreinte de notre histoire', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La posture raconte qui nous sommes — nos habitudes, nos émotions, notre rapport au monde. Changer sa posture, c\'est transformer bien plus que son corps.', corps: `Il n'existe pas une "bonne posture" figée. La meilleure posture est celle que vous quittez.\n\nPourtant, certains schémas créent de la souffrance : tête en avant, épaules enroulées, bassin basculé. Ces déséquilibres s'installent silencieusement sur des années.\n\nLa rééducation posturale commence par la perception. Sentir où est le poids dans les pieds. Percevoir la hauteur relative des hanches.\n\nLa posture juste émerge de l'intérieur — elle ne se plaque pas de l'extérieur.`, citation: 'Se tenir droit ne signifie pas se raidir. Ça signifie s\'aligner.' },
    { key: 'p5', titre: 'La respiration — le chef d\'orchestre oublié', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'On respire 20 000 fois par jour sans y penser. Et c\'est précisément le problème.', corps: `Le diaphragme est le muscle respiratoire principal. Quand il fonctionne pleinement, il masse les organes internes, stabilise la colonne, régule le système nerveux.\n\nMais la plupart d'entre nous respirons trop haut, trop vite, trop superficiellement.\n\nUne seule minute de respiration abdominale consciente peut diminuer le cortisol, ralentir le rythme cardiaque, libérer les tensions du bas du dos.\n\nApprendre à respirer — vraiment — c'est l'un des actes les plus transformateurs qu'on puisse poser pour son corps.`, citation: 'Dans chaque souffle conscient, le corps retrouve son chemin vers le calme.' },
    { key: 'p6', titre: 'La conscience corporelle — sentir pour bouger juste', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La proprioception est le sens le moins connu — et pourtant le plus fondamental. C\'est grâce à elle qu\'on sait où est notre corps dans l\'espace.', corps: `Des milliers de récepteurs sensoriels dans les muscles, les tendons et les articulations envoient en permanence des informations au cerveau.\n\nQuand cette carte intérieure est précise, le mouvement est fluide, économe, sans effort inutile. Quand elle est floue, le corps compense, surmène certains muscles, en ignore d'autres.\n\nLa conscience corporelle se cultive. Par le mouvement lent. Par l'attention portée aux sensations. Par le travail en fermeture des yeux.\n\nSentir juste, c'est la condition du mouvement juste.`, citation: 'Le corps sait. Il faut juste apprendre à l\'écouter.' },
    { key: 'p7', titre: 'Le Mat Pilates — le sol comme fondation', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Le Mat Pilates est la forme la plus pure de la méthode. Sans machine, sans accessoire — juste le corps, le sol, et la conscience.', corps: `Joseph Pilates l'appelait "Contrology" — l'art de contrôler le corps avec l'esprit. Le travail au sol en est l'expression la plus directe.\n\nSans le support du Reformer, le corps apprend à s'auto-stabiliser. Les muscles profonds — transverse de l'abdomen, multifides, plancher pelvien — deviennent les véritables acteurs du mouvement.\n\nChaque exercice au sol est une invitation à revenir à l'essentiel. Sentir le contact du dos sur le tapis. Percevoir la neutralité de la colonne. Activer le centre avant d'initier tout mouvement.\n\nLe Mat Pilates n'est pas une pratique "facile". C'est une pratique profonde, qui exige une conscience totale à chaque instant.`, citation: 'Le sol ne ment pas. Il révèle exactement où tu en es.' },
  ],
  en: [
    { key: 'p1', titre: 'The shoulder — the most free joint', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'The shoulder is the most mobile joint in the human body. This extraordinary freedom comes at a price: stability comes not from bone, but entirely from muscles.', corps: `The rotator cuff — four deep muscles — is the true conductor of every movement. When it is weak or poorly activated, tension insidiously settles in the trapezius, neck, sometimes down to the lower back.\n\nThe problem is never where it hurts.\n\nBefore strengthening, you must understand. Feel how the shoulder blade glides on the rib cage. Sense the weight of the arm settling into the joint.\n\nFrom this awareness, the right movement is born — fluid, effortless, pain-free.`, citation: 'A free shoulder is one that has learned to settle before it rises.' },
    { key: 'p2', titre: 'The back — why it really hurts', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Eight out of ten people will suffer from back pain at some point in their lives. Yet the pain is rarely where the problem lies.', corps: `The spine is a work of genius: 33 vertebrae, dozens of muscles, ligaments, shock-absorbing discs. Everything is designed for movement — not immobility.\n\nThe true enemy of the back is sedentary life. Sitting for hours shortens the psoas, imbalances the pelvis, crushes the discs.\n\nBut the back responds extraordinarily well when you restore awareness to it. Feel the breath inflate the posterior ribs. Perceive the space between each vertebra.\n\nThe back does not heal through rest. It heals through conscious movement.`, citation: 'A back in pain is a back asking to be heard.' },
    { key: 'p3', titre: 'Mobility — the youth of the body', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'We don\'t age first in our skin, but in our joints. Mobility is the most faithful measure of physical youth.', corps: `The hip is the body's center of gravity. When it locks up, everything compensates: the lower back, the knees, the shoulders.\n\nMobility is not the same as flexibility. You can be flexible without being mobile. Mobility is the ability to actively control a range of movement.\n\nIt is a skill. It is acquired, practiced, maintained. And every degree of freedom regained in a joint is an invitation to inhabit the body differently.\n\nTo mobilize is to rejuvenate.`, citation: 'Freedom of movement is not a luxury. It is a vital necessity.' },
    { key: 'p4', titre: 'Posture — the imprint of our history', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'Posture tells the story of who we are — our habits, emotions, relationship with the world. Changing your posture transforms far more than your body.', corps: `There is no single "correct posture". The best posture is the one you leave.\n\nYet certain patterns create suffering: head forward, rounded shoulders, tilted pelvis. These imbalances settle silently over years.\n\nPostural re-education begins with perception. Feel where the weight is in your feet. Sense the relative height of your hips.\n\nThe right posture emerges from within — it cannot be imposed from outside.`, citation: 'Standing tall doesn\'t mean stiffening up. It means aligning.' },
    { key: 'p5', titre: 'Breathing — the forgotten conductor', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'We breathe 20,000 times a day without thinking about it. And that is precisely the problem.', corps: `The diaphragm is the primary breathing muscle. When it works fully, it massages the internal organs, stabilizes the spine, regulates the nervous system.\n\nBut most of us breathe too high, too fast, too shallow.\n\nJust one minute of conscious abdominal breathing can lower cortisol, slow the heart rate, release lower back tension.\n\nLearning to breathe — truly — is one of the most transformative acts you can do for your body.`, citation: 'In every conscious breath, the body finds its way back to calm.' },
    { key: 'p6', titre: 'Body awareness — feel to move right', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'Proprioception is the least known sense — and yet the most fundamental. It is thanks to it that we know where our body is in space.', corps: `Thousands of sensory receptors in muscles, tendons and joints constantly send information to the brain.\n\nWhen this inner map is precise, movement is fluid, economical, effortless. When it is blurry, the body compensates, overworks some muscles, ignores others.\n\nBody awareness is cultivated. Through slow movement. Through attention to sensations. Through working with eyes closed.\n\nFeeling right is the condition for moving right.`, citation: 'The body knows. You just need to learn to listen to it.' },
    { key: 'p7', titre: 'Mat Pilates — the floor as foundation', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Mat Pilates is the purest form of the method. No machine, no accessory — just the body, the floor, and awareness.', corps: `Joseph Pilates called it "Contrology" — the art of controlling the body with the mind. Floorwork is its most direct expression.\n\nWithout the support of the Reformer, the body learns to self-stabilize. The deep muscles — transverse abdominis, multifidus, pelvic floor — become the true actors of movement.\n\nEach mat exercise is an invitation to return to the essential. Feel the contact of the back on the mat. Perceive the neutrality of the spine.\n\nMat Pilates is not an "easy" practice. It is a deep practice, demanding total awareness at every moment.`, citation: 'The floor doesn\'t lie. It reveals exactly where you are.' },
  ],
  es: [
    { key: 'p1', titre: 'El hombro — la articulación más libre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'El hombro es la articulación más móvil del cuerpo humano. Esta libertad extraordinaria tiene un precio: la estabilidad no viene del hueso, sino completamente de los músculos.', corps: `El manguito rotador — cuatro músculos profundos — es el verdadero director de cada movimiento. Cuando está débil o mal activado, las tensiones se instalan insidiosamente en los trapecios, el cuello, a veces hasta los lumbares.\n\nEl problema nunca está donde duele.\n\nAntes de fortalecer, hay que comprender. Sentir cómo el omóplato se desliza sobre la caja torácica.\n\nDesde esta conciencia nace el movimiento correcto — fluido, sin esfuerzo aparente, sin dolor.`, citation: 'Un hombro libre es uno que ha aprendido a posarse antes de elevarse.' },
    { key: 'p2', titre: 'La espalda — por qué realmente duele', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Ocho de cada diez personas sufrirán de dolor de espalda en algún momento de su vida. Sin embargo, el dolor rara vez está donde está el problema.', corps: `La columna vertebral es una obra maestra: 33 vértebras, decenas de músculos, ligamentos, discos amortiguadores. Todo está diseñado para el movimiento — no para la inmovilidad.\n\nEl verdadero enemigo de la espalda es el sedentarismo. Estar sentado horas acorta el psoas, desequilibra la pelvis, aplasta los discos.\n\nLa espalda no sana con el reposo. Sana con el movimiento consciente.`, citation: 'Una espalda que duele es una espalda que pide ser escuchada.' },
    { key: 'p3', titre: 'La movilidad — la juventud del cuerpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'No envejecemos primero en la piel, sino en las articulaciones. La movilidad es la medida más fiel de la juventud corporal.', corps: `La cadera es el centro de gravedad del cuerpo. Cuando se bloquea, todo compensa: los lumbares, las rodillas, los hombros.\n\nLa movilidad no se confunde con la flexibilidad. Puedes ser flexible sin ser móvil. La movilidad es la capacidad de controlar activamente un rango de movimiento.\n\nMovilizar es rejuvenecer.`, citation: 'La libertad de movimiento no es un lujo. Es una necesidad vital.' },
    { key: 'p4', titre: 'La postura — la huella de nuestra historia', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La postura cuenta quiénes somos — nuestros hábitos, emociones, relación con el mundo. Cambiar la postura es transformar mucho más que el cuerpo.', corps: `No existe una "buena postura" fija. La mejor postura es la que abandonas.\n\nSin embargo, ciertos esquemas crean sufrimiento: cabeza adelantada, hombros encorvados, pelvis inclinada.\n\nLa postura correcta emerge desde adentro — no se impone desde afuera.`, citation: 'Mantenerse erguido no significa ponerse rígido. Significa alinearse.' },
    { key: 'p5', titre: 'La respiración — el director olvidado', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiramos 20.000 veces al día sin pensarlo. Y ese es precisamente el problema.', corps: `El diafragma es el músculo respiratorio principal. Cuando funciona plenamente, masajea los órganos internos, estabiliza la columna, regula el sistema nervioso.\n\nAprender a respirar — de verdad — es uno de los actos más transformadores que puedes hacer por tu cuerpo.`, citation: 'En cada respiración consciente, el cuerpo encuentra su camino hacia la calma.' },
    { key: 'p6', titre: 'La conciencia corporal — sentir para moverse bien', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La propiocepción es el sentido menos conocido — y sin embargo el más fundamental.', corps: `Miles de receptores sensoriales en músculos, tendones y articulaciones envían constantemente información al cerebro.\n\nLa conciencia corporal se cultiva. A través del movimiento lento. A través de la atención a las sensaciones.\n\nSentir bien es la condición para moverse bien.`, citation: 'El cuerpo sabe. Solo hay que aprender a escucharlo.' },
    { key: 'p7', titre: 'Mat Pilates — el suelo como fundación', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'El Mat Pilates es la forma más pura del método. Sin máquina, sin accesorio — solo el cuerpo, el suelo y la conciencia.', corps: `Joseph Pilates lo llamaba "Contrología" — el arte de controlar el cuerpo con la mente. El trabajo en suelo es su expresión más directa.\n\nSin el soporte del Reformer, el cuerpo aprende a autoestabilizarse. Los músculos profundos se convierten en los verdaderos actores del movimiento.\n\nEl Mat Pilates no es una práctica "fácil". Es una práctica profunda que exige total conciencia en cada instante.`, citation: 'El suelo no miente. Revela exactamente dónde estás.' },
  ],
  it: [
    { key: 'p1', titre: 'La spalla — l\'articolazione più libera', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'La spalla è l\'articolazione più mobile del corpo umano.', corps: `La cuffia dei rotatori — quattro muscoli profondi — è il vero direttore d'orchestra di ogni movimento.\n\nIl problema non è mai dove fa male.\n\nDa questa consapevolezza nasce il movimento giusto — fluido, senza sforzo apparente, senza dolore.`, citation: 'Una spalla libera è una spalla che ha imparato a posarsi prima di elevarsi.' },
    { key: 'p2', titre: 'La schiena — perché fa davvero male', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Otto persone su dieci soffriranno di mal di schiena a un certo punto della loro vita.', corps: `La schiena non guarisce con il riposo. Guarisce con il movimento consapevole.`, citation: 'Una schiena che soffre è una schiena che chiede di essere ascoltata.' },
    { key: 'p3', titre: 'La mobilità — la giovinezza del corpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'Non invecchiamo prima nella pelle, ma nelle articolazioni.', corps: `Mobilizzare è ringiovanire.`, citation: 'La libertà di movimento non è un lusso. È una necessità vitale.' },
    { key: 'p4', titre: 'La postura — l\'impronta della nostra storia', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La postura racconta chi siamo.', corps: `La postura giusta emerge dall'interno — non si impone dall'esterno.`, citation: 'Stare dritti non significa irrigidirsi. Significa allinearsi.' },
    { key: 'p5', titre: 'La respirazione — il direttore dimenticato', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiriamo 20.000 volte al giorno senza pensarci.', corps: `Imparare a respirare — davvero — è uno degli atti più trasformativi che si possano fare per il proprio corpo.`, citation: 'In ogni respiro consapevole, il corpo ritrova la sua strada verso la calma.' },
    { key: 'p6', titre: 'La consapevolezza corporea — sentire per muoversi bene', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La propriocezione è il senso meno conosciuto — eppure il più fondamentale.', corps: `La consapevolezza corporea si coltiva. Attraverso il movimento lento.\n\nSentire bene è la condizione per muoversi bene.`, citation: 'Il corpo sa. Bisogna solo imparare ad ascoltarlo.' },
    { key: 'p7', titre: 'Mat Pilates — il pavimento come fondamento', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Il Mat Pilates è la forma più pura del metodo. Senza macchine, senza accessori — solo il corpo, il pavimento e la consapevolezza.', corps: `Joseph Pilates lo chiamava "Contrologia" — l'arte di controllare il corpo con la mente. Il lavoro a terra ne è l'espressione più diretta.\n\nSenza il supporto del Reformer, il corpo impara ad auto-stabilizzarsi. I muscoli profondi diventano i veri protagonisti del movimento.\n\nIl Mat Pilates non è una pratica "facile". È una pratica profonda che richiede totale consapevolezza in ogni istante.`, citation: 'Il pavimento non mente. Rivela esattamente dove sei.' },
  ],
  de: [
    { key: 'p1', titre: 'Die Schulter — das freieste Gelenk', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'Die Schulter ist das beweglichste Gelenk des menschlichen Körpers. Diese außergewöhnliche Freiheit hat einen Preis: Stabilität kommt nicht vom Knochen, sondern vollständig von den Muskeln.', corps: `Die Rotatorenmanschette — vier tiefe Muskeln — ist der wahre Dirigent jeder Bewegung. Wenn sie schwach oder schlecht aktiviert ist, setzen sich Verspannungen schleichend im Trapezmuskel, Nacken und manchmal bis in den unteren Rücken fest.\n\nDas Problem ist nie dort, wo es schmerzt.\n\nBevor man stärkt, muss man verstehen. Spüren, wie das Schulterblatt über den Brustkorb gleitet.\n\nAus diesem Bewusstsein entsteht die richtige Bewegung — fließend, mühelos, schmerzfrei.`, citation: 'Eine freie Schulter ist eine, die gelernt hat, sich niederzulassen, bevor sie sich hebt.' },
    { key: 'p2', titre: 'Der Rücken — warum er wirklich schmerzt', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Acht von zehn Menschen werden irgendwann in ihrem Leben Rückenschmerzen haben. Doch der Schmerz ist selten dort, wo das Problem liegt.', corps: `Die Wirbelsäule ist ein Meisterwerk: 33 Wirbel, Dutzende Muskeln, Bänder, stoßdämpfende Bandscheiben. Alles ist für Bewegung gemacht — nicht für Stillstand.\n\nDer wahre Feind des Rückens ist das Sitzen. Stundenlanges Sitzen verkürzt den Psoas, bringt das Becken aus dem Gleichgewicht.\n\nDer Rücken heilt nicht durch Ruhe. Er heilt durch bewusste Bewegung.`, citation: 'Ein schmerzender Rücken ist ein Rücken, der gehört werden möchte.' },
    { key: 'p3', titre: 'Mobilität — die Jugend des Körpers', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'Wir altern nicht zuerst in der Haut, sondern in den Gelenken. Mobilität ist das treueste Maß körperlicher Jugend.', corps: `Die Hüfte ist der Schwerpunkt des Körpers. Wenn sie blockiert, kompensiert alles: der untere Rücken, die Knie, die Schultern.\n\nMobilität ist nicht dasselbe wie Flexibilität. Mobilisieren heißt verjüngen.`, citation: 'Bewegungsfreiheit ist kein Luxus. Sie ist eine lebenswichtige Notwendigkeit.' },
    { key: 'p4', titre: 'Haltung — der Abdruck unserer Geschichte', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'Die Haltung erzählt, wer wir sind — unsere Gewohnheiten, Emotionen, unsere Beziehung zur Welt.', corps: `Es gibt keine einzige "richtige Haltung". Die beste Haltung ist die, die man verlässt.\n\nDie richtige Haltung entsteht von innen — sie lässt sich nicht von außen aufzwingen.`, citation: 'Aufrecht stehen bedeutet nicht, sich zu versteifen. Es bedeutet, sich auszurichten.' },
    { key: 'p5', titre: 'Die Atmung — der vergessene Dirigent', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Wir atmen 20.000 Mal am Tag, ohne darüber nachzudenken. Und genau das ist das Problem.', corps: `Das Zwerchfell ist der wichtigste Atemmuskel. Richtig atmen zu lernen — wirklich — ist einer der transformativsten Akte für den Körper.`, citation: 'In jedem bewussten Atemzug findet der Körper seinen Weg zur Ruhe.' },
    { key: 'p6', titre: 'Körperbewusstsein — spüren, um richtig zu bewegen', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'Propriozeption ist der am wenigsten bekannte Sinn — und doch der grundlegendste.', corps: `Körperbewusstsein wird kultiviert. Durch langsame Bewegung. Durch Aufmerksamkeit auf Empfindungen.\n\nRichtig spüren ist die Voraussetzung für richtige Bewegung.`, citation: 'Der Körper weiß. Man muss nur lernen, ihm zuzuhören.' },
    { key: 'p7', titre: 'Mat Pilates — der Boden als Fundament', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Mat Pilates ist die reinste Form der Methode. Keine Maschine, kein Zubehör — nur der Körper, der Boden und das Bewusstsein.', corps: `Joseph Pilates nannte es "Contrology" — die Kunst, den Körper mit dem Geist zu kontrollieren. Die Bodenarbeit ist ihr direktester Ausdruck.\n\nMat Pilates ist keine "einfache" Praxis. Es ist eine tiefe Praxis, die in jedem Moment vollständige Bewusstheit verlangt.`, citation: 'Der Boden lügt nicht. Er zeigt genau, wo du stehst.' },
  ],
  pt: [
    { key: 'p1', titre: 'O ombro — a articulação mais livre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'O ombro é a articulação mais móvel do corpo humano. Essa liberdade extraordinária tem um preço: a estabilidade vem não do osso, mas inteiramente dos músculos.', corps: `O manguito rotador — quatro músculos profundos — é o verdadeiro maestro de cada movimento. Quando está fraco ou mal ativado, as tensões se instalam nos trapézios, pescoço e às vezes até a lombar.\n\nO problema nunca está onde dói.\n\nAntes de fortalecer, é preciso entender. Sentir como a escápula desliza sobre a caixa torácica.\n\nDessa consciência nasce o movimento correto — fluido, sem esforço, sem dor.`, citation: 'Um ombro livre é um ombro que aprendeu a pousar antes de se elevar.' },
    { key: 'p2', titre: 'As costas — por que realmente dói', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Oito em cada dez pessoas terão dor nas costas em algum momento da vida. No entanto, a dor raramente está onde o problema se encontra.', corps: `A coluna vertebral é uma obra-prima: 33 vértebras, dezenas de músculos, ligamentos, discos amortecedores. Tudo é projetado para o movimento — não para a imobilidade.\n\nAs costas não curam com repouso. Curam com movimento consciente.`, citation: 'Uma coluna que dói é uma coluna que pede para ser ouvida.' },
    { key: 'p3', titre: 'Mobilidade — a juventude do corpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'Não envelhecemos primeiro na pele, mas nas articulações. A mobilidade é a medida mais fiel da juventude corporal.', corps: `O quadril é o centro de gravidade do corpo. Quando bloqueia, tudo compensa.\n\nMobilizar é rejuvenescer.`, citation: 'Liberdade de movimento não é luxo. É uma necessidade vital.' },
    { key: 'p4', titre: 'A postura — a marca da nossa história', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'A postura conta quem somos — nossos hábitos, emoções, relação com o mundo.', corps: `A postura correta emerge de dentro — não se impõe de fora.`, citation: 'Ficar ereto não significa enrijecer. Significa alinhar-se.' },
    { key: 'p5', titre: 'A respiração — o maestro esquecido', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiramos 20.000 vezes por dia sem pensar. E esse é exatamente o problema.', corps: `Aprender a respirar — de verdade — é um dos atos mais transformadores que se pode fazer pelo corpo.`, citation: 'Em cada respiração consciente, o corpo encontra seu caminho para a calma.' },
    { key: 'p6', titre: 'Consciência corporal — sentir para se mover bem', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'A propriocepção é o sentido menos conhecido — e, no entanto, o mais fundamental.', corps: `A consciência corporal se cultiva. Através do movimento lento.\n\nSentir bem é a condição para se mover bem.`, citation: 'O corpo sabe. Basta aprender a ouvi-lo.' },
    { key: 'p7', titre: 'Mat Pilates — o chão como fundação', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'O Mat Pilates é a forma mais pura do método. Sem máquinas, sem acessórios — apenas o corpo, o chão e a consciência.', corps: `Joseph Pilates chamava de "Contrologia" — a arte de controlar o corpo com a mente. O trabalho no solo é sua expressão mais direta.\n\nO Mat Pilates não é uma prática "fácil". É uma prática profunda que exige consciência total em cada instante.`, citation: 'O chão não mente. Ele revela exatamente onde você está.' },
  ],
  zh: [
    { key: 'p1', titre: '肩膀 — 最自由的关节', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: '肩膀是人体最灵活的关节。这种非凡的自由是有代价的：稳定性不来自骨骼，而完全来自肌肉。', corps: `肩袖 — 四块深层肌肉 — 是每个动作的真正指挥者。当它虚弱或激活不良时，紧张会悄然蔓延到斜方肌、颈部，甚至腰部。\n\n问题从来不在疼痛的地方。\n\n在加强之前，必须先理解。感受肩胛骨如何在胸廓上滑动。\n\n从这种意识中，正确的动作诞生了 — 流畅、毫不费力、无痛。`, citation: '自由的肩膀是学会先安定再提升的肩膀。' },
    { key: 'p2', titre: '背部 — 为什么真的会痛', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: '十个人中有八个会在一生中某个时候经历背痛。然而，疼痛很少出现在问题所在的地方。', corps: `脊柱是一项杰作：33节椎骨、数十块肌肉、韧带、减震椎间盘。一切都是为运动设计的 — 而不是静止。\n\n背部不靠休息痊愈。它靠有意识的运动痊愈。`, citation: '疼痛的背部是一个请求被倾听的背部。' },
    { key: 'p3', titre: '灵活性 — 身体的青春', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: '我们不是先从皮肤开始衰老，而是从关节。灵活性是身体青春最忠实的衡量标准。', corps: `髋部是身体的重心。当它锁住时，一切都在代偿。\n\n活动就是重返青春。`, citation: '运动自由不是奢侈。它是生命的必需。' },
    { key: 'p4', titre: '姿势 — 我们历史的印记', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: '姿势讲述了我们是谁 — 我们的习惯、情感、与世界的关系。', corps: `正确的姿势从内在产生 — 不能从外部强加。`, citation: '站直不意味着僵硬。它意味着对齐。' },
    { key: 'p5', titre: '呼吸 — 被遗忘的指挥者', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: '我们每天呼吸20000次却不加思考。这恰恰就是问题所在。', corps: `学会真正地呼吸 — 是你能为身体做的最具变革性的行为之一。`, citation: '在每一次有意识的呼吸中，身体找到了通往平静的道路。' },
    { key: 'p6', titre: '身体意识 — 感受以正确运动', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: '本体感觉是最不为人知的感觉 — 却是最基本的。', corps: `身体意识需要培养。通过缓慢的运动。\n\n正确地感受是正确运动的前提。`, citation: '身体知道。你只需要学会倾听它。' },
    { key: 'p7', titre: '垫上普拉提 — 以地面为基础', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: '垫上普拉提是该方法最纯粹的形式。没有器械，没有配件 — 只有身体、地面和意识。', corps: `Joseph Pilates称其为"控制学" — 用心灵控制身体的艺术。地面训练是其最直接的表达。\n\n垫上普拉提不是一种"简单"的练习。它是一种深层练习，要求每时每刻的全面意识。`, citation: '地面不会撒谎。它准确地揭示你所处的位置。' },
  ],
  ja: [
    { key: 'p1', titre: '肩 — 最も自由な関節', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: '肩は人体で最も可動性の高い関節です。この並外れた自由には代償があります：安定性は骨からではなく、完全に筋肉から生まれます。', corps: `回旋筋腱板 — 4つの深層筋 — はすべての動きの真の指揮者です。弱かったり活性化が不十分だと、緊張は僧帽筋、首、時には腰まで忍び寄ります。\n\n問題は痛みのある場所にはありません。\n\n強化する前に理解すること。肩甲骨が胸郭の上を滑る感覚。\n\nこの意識から正しい動きが生まれます — 流れるように、無理なく、痛みなく。`, citation: '自由な肩とは、上がる前にまず落ち着くことを学んだ肩です。' },
    { key: 'p2', titre: '背中 — なぜ本当に痛むのか', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: '10人中8人が人生のどこかで背中の痛みに悩まされます。しかし、痛みの場所と問題の場所は違うことが多いのです。', corps: `脊柱は天才的な構造です：33の椎骨、数十の筋肉、靭帯、衝撃吸収椎間板。すべては動きのために設計されています。\n\n背中は安静では治りません。意識的な動きで治ります。`, citation: '痛む背中は、聞いてほしいと訴えている背中です。' },
    { key: 'p3', titre: 'モビリティ — 身体の若さ', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: '私たちは肌からではなく、関節から老化します。モビリティは身体の若さの最も忠実な指標です。', corps: `股関節は体の重心です。固まると、すべてが代償します。\n\n動かすことは若返ること。`, citation: '動きの自由は贅沢ではありません。生命の必需品です。' },
    { key: 'p4', titre: '姿勢 — 私たちの歴史の刻印', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: '姿勢は私たちが誰であるかを語ります — 習慣、感情、世界との関係。', corps: `正しい姿勢は内側から生まれます — 外側から押し付けることはできません。`, citation: 'まっすぐ立つとは、硬くなることではありません。整列することです。' },
    { key: 'p5', titre: '呼吸 — 忘れられた指揮者', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: '私たちは1日に2万回、考えずに呼吸しています。そして、まさにそれが問題なのです。', corps: `本当の呼吸を学ぶこと — それは身体のためにできる最も変革的な行為の一つです。`, citation: '意識的な一呼吸のたびに、身体は静けさへの道を見つけます。' },
    { key: 'p6', titre: '身体意識 — 正しく動くために感じる', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: '固有受容感覚は最も知られていない感覚 — しかし最も基本的な感覚です。', corps: `身体意識は育まれるものです。ゆっくりとした動きを通して。\n\n正しく感じることが、正しく動くための条件です。`, citation: '身体は知っている。ただ耳を傾けることを学ぶだけです。' },
    { key: 'p7', titre: 'マットピラティス — 床を基盤として', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'マットピラティスはメソッドの最も純粋な形です。マシンなし、器具なし — 身体と床と意識だけ。', corps: `ジョセフ・ピラティスはこれを「コントロロジー」と呼びました — 心で体をコントロールする技術。マット運動はその最も直接的な表現です。\n\nマットピラティスは「簡単な」実践ではありません。毎瞬間の完全な意識を要求する深い実践です。`, citation: '床は嘘をつきません。あなたが今どこにいるかを正確に明らかにします。' },
  ],
  ko: [
    { key: 'p1', titre: '어깨 — 가장 자유로운 관절', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: '어깨는 인체에서 가장 움직임이 많은 관절입니다. 이 놀라운 자유에는 대가가 있습니다: 안정성은 뼈가 아닌 근육에서 나옵니다.', corps: `회전근개 — 네 개의 심부 근육 — 는 모든 움직임의 진정한 지휘자입니다. 약하거나 제대로 활성화되지 않으면 긴장이 승모근, 목, 때로는 허리까지 은밀히 퍼집니다.\n\n문제는 아픈 곳에 있지 않습니다.\n\n강화하기 전에 이해해야 합니다. 견갑골이 흉곽 위로 미끄러지는 느낌.\n\n이 인식에서 올바른 움직임이 탄생합니다 — 유연하게, 힘들이지 않고, 통증 없이.`, citation: '자유로운 어깨는 올라가기 전에 먼저 안정되는 법을 배운 어깨입니다.' },
    { key: 'p2', titre: '등 — 왜 정말 아픈가', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: '10명 중 8명이 살면서 한 번은 허리 통증을 겪습니다. 하지만 통증이 있는 곳이 문제가 있는 곳은 아닙니다.', corps: `척추는 걸작입니다: 33개의 척추뼈, 수십 개의 근육, 인대, 충격 흡수 디스크.\n\n등은 휴식으로 낫지 않습니다. 의식적인 움직임으로 낫습니다.`, citation: '아픈 등은 들어달라고 요청하는 등입니다.' },
    { key: 'p3', titre: '유연성 — 몸의 젊음', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: '우리는 피부가 아닌 관절에서 먼저 노화합니다. 유연성은 신체 젊음의 가장 정확한 척도입니다.', corps: `골반은 몸의 무게 중심입니다. 막히면 모든 것이 보상합니다.\n\n움직이는 것이 젊어지는 것입니다.`, citation: '움직임의 자유는 사치가 아닙니다. 생명의 필수입니다.' },
    { key: 'p4', titre: '자세 — 우리 역사의 흔적', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: '자세는 우리가 누구인지를 말합니다 — 습관, 감정, 세상과의 관계.', corps: `올바른 자세는 내면에서 나옵니다 — 외부에서 강요할 수 없습니다.`, citation: '곧게 서는 것은 뻣뻣해지는 것이 아닙니다. 정렬하는 것입니다.' },
    { key: 'p5', titre: '호흡 — 잊혀진 지휘자', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: '우리는 하루에 2만 번 생각 없이 숨을 쉽니다. 바로 그것이 문제입니다.', corps: `진정으로 호흡하는 법을 배우는 것 — 그것은 몸을 위해 할 수 있는 가장 변혁적인 행위 중 하나입니다.`, citation: '의식적인 호흡 하나하나에서 몸은 평온으로 가는 길을 찾습니다.' },
    { key: 'p6', titre: '신체 인식 — 올바르게 움직이기 위해 느끼기', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: '고유수용감각은 가장 잘 알려지지 않은 감각이지만, 가장 근본적인 감각입니다.', corps: `신체 인식은 배양됩니다. 느린 움직임을 통해.\n\n올바르게 느끼는 것이 올바르게 움직이기 위한 조건입니다.`, citation: '몸은 알고 있습니다. 단지 귀 기울이는 법을 배우면 됩니다.' },
    { key: 'p7', titre: '매트 필라테스 — 바닥을 기반으로', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: '매트 필라테스는 이 방법의 가장 순수한 형태입니다. 기계도 도구도 없이 — 몸, 바닥, 그리고 인식만으로.', corps: `조셉 필라테스는 이것을 "컨트롤로지"라고 불렀습니다 — 마음으로 몸을 제어하는 기술. 바닥 운동은 그 가장 직접적인 표현입니다.\n\n매트 필라테스는 "쉬운" 수련이 아닙니다. 매 순간 완전한 인식을 요구하는 깊은 수련입니다.`, citation: '바닥은 거짓말을 하지 않습니다. 당신이 어디에 있는지 정확히 보여줍니다.' },
  ],
};

const FICHES = {
  fr: [
    { etape: 'Comprendre', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Savoir ce qu\'on fait et pourquoi', description: 'Avant de bouger, comprendre. Quelle articulation travaille ? Quel muscle s\'active ? La compréhension anatomique transforme un exercice mécanique en acte conscient.', points: ['Nommer ce qu\'on ressent', 'Comprendre la mécanique articulaire', 'Identifier les compensations habituelles', 'Visualiser le mouvement avant de le faire'] },
    { etape: 'Ressentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Développer la carte intérieure', description: 'Fermer les yeux. Écouter. Où est la tension ? Où est le relâchement ? Le ressenti précède toujours le mouvement juste.', points: ['Scanner le corps sans jugement', 'Distinguer tension utile et tension parasite', 'Sentir les asymétries gauche/droite', 'Habiter chaque partie du corps tour à tour'] },
    { etape: 'Préparer', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activer avant de performer', description: 'Le corps ne passe pas de 0 à 100. La préparation éveille les stabilisateurs profonds, chauffe les articulations, active les connexions neuromusculaires.', points: ['Mobiliser les articulations concernées', 'Activer les muscles stabilisateurs', 'Établir le pattern respiratoire', 'Centrer l\'attention sur la zone de travail'] },
    { etape: 'Exécuter', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Le geste juste, pas le geste fort', description: 'L\'exécution dans la méthode FluidBody n\'est jamais brutale. La qualité prime sur la quantité. Un mouvement lent, précis, respiré, a cent fois plus de valeur.', points: ['Maintenir la conscience pendant l\'effort', 'Respirer — ne jamais bloquer le souffle', 'Travailler en amplitude contrôlée', 'Sentir le muscle cible, pas les compensations'] },
    { etape: 'Évoluer', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progresser sans se perdre', description: 'L\'évolution n\'est pas une course. C\'est une spirale ascendante — on revient aux mêmes gestes, mais avec une conscience plus fine, une capacité plus grande.', points: ['Augmenter l\'amplitude avant la charge', 'Intégrer le mouvement au quotidien', 'Mesurer le progrès par la qualité', 'Revenir aux bases pour mieux avancer'] },
  ],
  en: [
    { etape: 'Understand', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Know what you\'re doing and why', description: 'Before moving, understand. Which joint is working? Which muscle is activating? Anatomical understanding transforms a mechanical exercise into a conscious act.', points: ['Name what you feel', 'Understand joint mechanics', 'Identify habitual compensations', 'Visualize the movement before doing it'] },
    { etape: 'Feel', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Develop your inner map', description: 'Close your eyes. Listen. Where is the tension? Where is the release? Feeling always precedes the right movement.', points: ['Scan the body without judgment', 'Distinguish useful tension from parasitic tension', 'Feel left/right asymmetries', 'Inhabit each part of the body in turn'] },
    { etape: 'Prepare', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activate before performing', description: 'The body doesn\'t go from 0 to 100. Preparation awakens deep stabilizers, warms the joints, activates neuromuscular connections.', points: ['Mobilize the relevant joints', 'Activate stabilizer muscles', 'Establish breathing pattern', 'Center attention on the work area'] },
    { etape: 'Execute', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'The right gesture, not the strong one', description: 'Execution in the FluidBody method is never brutal. Quality trumps quantity. A slow, precise, breathing movement has a hundred times more value.', points: ['Maintain awareness during effort', 'Breathe — never hold your breath', 'Work in controlled range', 'Feel the target muscle, not compensations'] },
    { etape: 'Evolve', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progress without getting lost', description: 'Evolution is not a race. It is an upward spiral — we return to the same movements, but with finer awareness, greater capacity.', points: ['Increase range before load', 'Integrate movement into daily life', 'Measure progress by quality', 'Return to basics to move forward better'] },
  ],
  es: [
    { etape: 'Comprender', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Saber qué hacemos y por qué', description: 'Antes de moverse, comprender. ¿Qué articulación trabaja? ¿Qué músculo se activa?', points: ['Nombrar lo que se siente', 'Comprender la mecánica articular', 'Identificar las compensaciones habituales', 'Visualizar el movimiento antes de hacerlo'] },
    { etape: 'Sentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Desarrollar el mapa interior', description: 'Cerrar los ojos. Escuchar. ¿Dónde está la tensión?', points: ['Escanear el cuerpo sin juicio', 'Distinguir tensión útil de tensión parásita', 'Sentir las asimetrías izquierda/derecha', 'Habitar cada parte del cuerpo por turno'] },
    { etape: 'Preparar', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activar antes de rendir', description: 'El cuerpo no pasa de 0 a 100. La preparación despierta los estabilizadores profundos.', points: ['Movilizar las articulaciones implicadas', 'Activar los músculos estabilizadores', 'Establecer el patrón respiratorio', 'Centrar la atención en la zona de trabajo'] },
    { etape: 'Ejecutar', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'El gesto correcto, no el forzado', description: 'La ejecución en el método FluidBody nunca es brusca. La calidad prima sobre la cantidad.', points: ['Mantener la conciencia durante el esfuerzo', 'Respirar — nunca bloquear el aliento', 'Trabajar en amplitud controlada', 'Sentir el músculo objetivo, no las compensaciones'] },
    { etape: 'Evolucionar', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progresar sin perderse', description: 'La evolución no es una carrera. Es una espiral ascendente.', points: ['Aumentar la amplitud antes de la carga', 'Integrar el movimiento en la vida diaria', 'Medir el progreso por la calidad', 'Volver a lo básico para avanzar mejor'] },
  ],
  it: [
    { etape: 'Capire', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Sapere cosa si fa e perché', description: 'Prima di muoversi, capire.', points: ['Nominare ciò che si sente', 'Capire la meccanica articolare', 'Identificare le compensazioni abituali', 'Visualizzare il movimento prima di farlo'] },
    { etape: 'Sentire', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Sviluppare la mappa interiore', description: 'Chiudere gli occhi. Ascoltare.', points: ['Scansionare il corpo senza giudizio', 'Distinguere tensione utile da tensione parassita', 'Sentire le asimmetrie sinistra/destra', 'Abitare ogni parte del corpo a turno'] },
    { etape: 'Preparare', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Attivare prima di performare', description: 'Il corpo non passa da 0 a 100.', points: ['Mobilizzare le articolazioni coinvolte', 'Attivare i muscoli stabilizzatori', 'Stabilire il pattern respiratorio', 'Centrare l\'attenzione sulla zona di lavoro'] },
    { etape: 'Eseguire', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Il gesto giusto, non quello forte', description: 'L\'esecuzione nel metodo FluidBody non è mai brusca.', points: ['Mantenere la consapevolezza durante lo sforzo', 'Respirare — non bloccare mai il respiro', 'Lavorare in ampiezza controllata', 'Sentire il muscolo bersaglio, non le compensazioni'] },
    { etape: 'Evolvere', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progredire senza perdersi', description: 'L\'evoluzione non è una corsa.', points: ['Aumentare l\'ampiezza prima del carico', 'Integrare il movimento nella vita quotidiana', 'Misurare il progresso dalla qualità', 'Tornare alle basi per andare avanti meglio'] },
  ],
  de: [
    { etape: 'Verstehen', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Wissen, was man tut und warum', description: 'Bevor man sich bewegt, verstehen. Welches Gelenk arbeitet? Welcher Muskel wird aktiviert?', points: ['Benennen, was man spürt', 'Die Gelenkmechanik verstehen', 'Gewohnheitskompensationen erkennen', 'Die Bewegung visualisieren, bevor man sie ausführt'] },
    { etape: 'Spüren', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Die innere Landkarte entwickeln', description: 'Augen schließen. Lauschen. Wo ist die Spannung?', points: ['Den Körper ohne Urteil scannen', 'Nützliche von parasitärer Spannung unterscheiden', 'Links/Rechts-Asymmetrien spüren', 'Jeden Körperteil nacheinander bewohnen'] },
    { etape: 'Vorbereiten', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Aktivieren vor dem Ausführen', description: 'Der Körper geht nicht von 0 auf 100. Vorbereitung weckt die tiefen Stabilisatoren.', points: ['Die betroffenen Gelenke mobilisieren', 'Stabilisierungsmuskeln aktivieren', 'Das Atemmuster etablieren', 'Die Aufmerksamkeit auf den Arbeitsbereich zentrieren'] },
    { etape: 'Ausführen', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Die richtige Geste, nicht die kräftige', description: 'Ausführung in der FluidBody-Methode ist nie brutal. Qualität vor Quantität.', points: ['Bewusstsein während der Anstrengung beibehalten', 'Atmen — nie den Atem anhalten', 'In kontrolliertem Bewegungsumfang arbeiten', 'Den Zielmuskel spüren, nicht die Kompensationen'] },
    { etape: 'Weiterentwickeln', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Fortschreiten ohne sich zu verlieren', description: 'Entwicklung ist kein Rennen. Es ist eine aufsteigende Spirale.', points: ['Bewegungsumfang vor Belastung steigern', 'Bewegung in den Alltag integrieren', 'Fortschritt an der Qualität messen', 'Zu den Grundlagen zurückkehren, um besser voranzukommen'] },
  ],
  pt: [
    { etape: 'Compreender', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Saber o que se faz e por quê', description: 'Antes de se mover, compreender. Qual articulação trabalha? Qual músculo se ativa?', points: ['Nomear o que se sente', 'Compreender a mecânica articular', 'Identificar compensações habituais', 'Visualizar o movimento antes de fazê-lo'] },
    { etape: 'Sentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Desenvolver o mapa interior', description: 'Fechar os olhos. Ouvir. Onde está a tensão?', points: ['Escanear o corpo sem julgamento', 'Distinguir tensão útil de tensão parasita', 'Sentir assimetrias esquerda/direita', 'Habitar cada parte do corpo por vez'] },
    { etape: 'Preparar', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Ativar antes de performar', description: 'O corpo não passa de 0 a 100. A preparação desperta os estabilizadores profundos.', points: ['Mobilizar as articulações envolvidas', 'Ativar os músculos estabilizadores', 'Estabelecer o padrão respiratório', 'Centrar a atenção na área de trabalho'] },
    { etape: 'Executar', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'O gesto certo, não o forçado', description: 'A execução no método FluidBody nunca é brusca. Qualidade acima de quantidade.', points: ['Manter a consciência durante o esforço', 'Respirar — nunca prender a respiração', 'Trabalhar em amplitude controlada', 'Sentir o músculo-alvo, não as compensações'] },
    { etape: 'Evoluir', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progredir sem se perder', description: 'Evolução não é uma corrida. É uma espiral ascendente.', points: ['Aumentar a amplitude antes da carga', 'Integrar o movimento no dia a dia', 'Medir o progresso pela qualidade', 'Voltar ao básico para avançar melhor'] },
  ],
  zh: [
    { etape: '理解', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: '知道做什么以及为什么', description: '在运动之前，先理解。哪个关节在工作？哪块肌肉在激活？', points: ['命名你的感受', '理解关节力学', '识别习惯性代偿', '在做动作前先想象它'] },
    { etape: '感受', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: '发展内在地图', description: '闭上眼睛。倾听。哪里有紧张？', points: ['不带评判地扫描身体', '区分有用的紧张和多余的紧张', '感受左右不对称', '依次感知身体的每个部位'] },
    { etape: '准备', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: '先激活再执行', description: '身体不会从0直接到100。准备唤醒深层稳定肌。', points: ['活动相关关节', '激活稳定肌群', '建立呼吸模式', '将注意力集中在工作区域'] },
    { etape: '执行', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: '正确的动作，而非用力的动作', description: 'FluidBody方法中的执行从不粗暴。质量优于数量。', points: ['在用力时保持意识', '呼吸 — 永远不要屏住呼吸', '在可控幅度内工作', '感受目标肌肉，而非代偿'] },
    { etape: '进阶', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: '进步而不迷失', description: '进化不是竞赛。它是一个上升的螺旋。', points: ['先增加幅度再增加负荷', '将运动融入日常生活', '以质量衡量进步', '回归基础以更好地前进'] },
  ],
  ja: [
    { etape: '理解する', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: '何をなぜ行うのかを知る', description: '動く前にまず理解する。どの関節が働く？どの筋肉が活性化する？', points: ['感じることに名前をつける', '関節の仕組みを理解する', '習慣的な代償を見つける', '動く前に動きをイメージする'] },
    { etape: '感じる', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: '内なる地図を育てる', description: '目を閉じる。耳を澄ます。どこに緊張がある？', points: ['判断せずに身体をスキャンする', '有用な緊張と不要な緊張を区別する', '左右の非対称を感じる', '身体の各部位を順に意識する'] },
    { etape: '準備する', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: '実行する前に活性化する', description: '身体は0から100には行けません。準備が深層安定筋を目覚めさせます。', points: ['関連する関節を動かす', '安定筋を活性化する', '呼吸パターンを確立する', '作業領域に注意を集中する'] },
    { etape: '実行する', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: '正しい動き、力任せではなく', description: 'FluidBodyメソッドの実行は決して乱暴ではありません。量より質。', points: ['努力中も意識を保つ', '呼吸する — 息を止めない', 'コントロールされた範囲で動く', '代償ではなくターゲット筋を感じる'] },
    { etape: '進化する', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: '迷わずに進歩する', description: '進化はレースではありません。上昇する螺旋です。', points: ['負荷の前に可動域を広げる', '日常生活に動きを取り入れる', '質で進歩を測る', 'より良く進むために基本に戻る'] },
  ],
  ko: [
    { etape: '이해하기', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: '무엇을 왜 하는지 알기', description: '움직이기 전에 이해하기. 어떤 관절이 작동하는가? 어떤 근육이 활성화되는가?', points: ['느끼는 것에 이름 붙이기', '관절 역학 이해하기', '습관적 보상 패턴 파악하기', '동작 전에 움직임 시각화하기'] },
    { etape: '느끼기', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: '내면의 지도 개발하기', description: '눈을 감으세요. 귀를 기울이세요. 어디에 긴장이 있나요?', points: ['판단 없이 몸을 스캔하기', '유용한 긴장과 불필요한 긴장 구분하기', '좌우 비대칭 느끼기', '몸의 각 부위를 차례로 의식하기'] },
    { etape: '준비하기', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: '실행 전에 활성화하기', description: '몸은 0에서 100으로 갈 수 없습니다. 준비가 깊은 안정근을 깨웁니다.', points: ['관련 관절 동원하기', '안정근 활성화하기', '호흡 패턴 확립하기', '작업 영역에 주의 집중하기'] },
    { etape: '실행하기', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: '올바른 동작, 강한 동작이 아닌', description: 'FluidBody 방법의 실행은 결코 거칠지 않습니다. 양보다 질.', points: ['노력 중에도 인식 유지하기', '호흡하기 — 숨을 참지 않기', '제어된 범위에서 작업하기', '보상이 아닌 목표 근육 느끼기'] },
    { etape: '발전하기', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: '길을 잃지 않고 진보하기', description: '진화는 경주가 아닙니다. 상승하는 나선입니다.', points: ['부하 전에 가동 범위 늘리기', '일상에 움직임 통합하기', '질로 진행 상황 측정하기', '더 나아가기 위해 기본으로 돌아가기'] },
  ],
};

// ICONS stub — IconComp is assigned but not rendered in Biblio JSX
const ICONS = {};

function ArticleDetail({ article, onClose, lang }) {
  const tr = T[lang] || T['fr'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <ScrollView style={{ zIndex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 6 }}><Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1 }}>{tr.retour_biblio}</Text></TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 30 }}>+</Text></Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,18,32,0.7)', borderWidth: 0.5, borderColor: '#AEEF4D' }}>
              <Text style={{ fontSize: 9, color: '#AEEF4D', letterSpacing: 1 }}>{article.duree}{tr.lire}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '200', color: 'rgba(215,248,255,0.95)', lineHeight: 36, marginBottom: 20 }}>{article.titre}</Text>
          <Text style={{ fontSize: 17, fontWeight: '300', color: article.color, lineHeight: 28, marginBottom: 24, fontStyle: 'italic' }}>{article.intro}</Text>
          <Text style={{ fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.82)', lineHeight: 26, marginBottom: 32 }}>{article.corps}</Text>
          <View style={{ borderLeftWidth: 2, borderLeftColor: article.color, paddingLeft: 16, marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '200', color: 'rgba(215,248,255,0.9)', lineHeight: 26, fontStyle: 'italic' }}>{article.citation}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(0,210,250,0.4)', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' }}>{tr.biblio_signature}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function FicheDetail({ fiche, onClose, lang }) {
  const tr = T[lang] || T['fr'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <ScrollView style={{ zIndex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 6 }}><Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1 }}>{tr.retour_biblio}</Text></TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 30 }}>+</Text></Text>
          </View>
          <Text style={{ fontSize: 72, fontWeight: '200', color: '#AEEF4D', opacity: 0.3, lineHeight: 80 }}>{fiche.num}</Text>
          <Text style={{ fontSize: 32, fontWeight: '200', color: 'rgba(215,248,255,0.95)', lineHeight: 40, marginBottom: 8 }}>{fiche.etape}</Text>
          <Text style={{ fontSize: 16, fontWeight: '300', color: fiche.color, marginBottom: 24, fontStyle: 'italic' }}>{fiche.soustitre}</Text>
          <View style={{ backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 18, padding: 20, marginBottom: 24 }}>
            <Text style={{ fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.85)', lineHeight: 26 }}>{fiche.description}</Text>
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(0,210,250,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.points_cles}</Text>
          {fiche.points.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,18,32,0.8)', borderWidth: 1, borderColor: fiche.color, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                <Text style={{ fontSize: 10, color: fiche.color, fontWeight: '500' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.85)', lineHeight: 24 }}>{p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}


// ══════════════════════════════════
// BIBLIOTHEQUE — sans player podcast
// ══════════════════════════════════
function Biblio({ lang }) {
  const tr = T[lang] || T['fr'];
  const [tab, setTab] = useState('piliers');
  const [openArticle, setOpenArticle] = useState(null);
  const [openFiche, setOpenFiche] = useState(null);
  const articles = ARTICLES[lang] || ARTICLES.fr;
  const fiches = FICHES[lang] || FICHES.fr;

  if (openArticle) return <ArticleDetail article={openArticle} onClose={() => setOpenArticle(null)} lang={lang} />;
  if (openFiche) return <FicheDetail fiche={openFiche} onClose={() => setOpenFiche(null)} lang={lang} />;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      </View>
      <FloatingMedusas />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 40 }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={{ paddingTop: 62, paddingHorizontal: 6, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.biblio_sub}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            {['piliers', 'methode'].map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: tab === t ? 'rgba(174,239,77,0.7)' : 'rgba(174,239,77,0.2)', backgroundColor: tab === t ? 'rgba(174,239,77,0.18)' : 'rgba(0,18,32,0.5)' }}>
                <Text style={{ fontSize: 12, fontWeight: '300', color: tab === t ? '#AEEF4D' : 'rgba(174,239,77,0.5)' }}>{t === 'piliers' ? tr.tab_piliers : tr.tab_methode}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {tab === 'piliers' && (
          <View style={{ gap: 12 }}>
            {articles.map((a, i) => {
              const IconComp = ICONS[a.key];
              return (
                <TouchableOpacity key={i} onPress={() => setOpenArticle(a)} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 14 }}>
                      <ImageBackground source={PILIER_IMAGES[a.key]} resizeMode="cover" style={{ flex: 1 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '300', color: '#ffffff', lineHeight: 22 }}>{a.titre}</Text>
                      <Text style={{ fontSize: 10, color: '#AEEF4D', marginTop: 3 }}>{a.duree}{tr.lire}</Text>
                    </View>
                    <Text style={{ fontSize: 18, color: 'rgba(174,239,77,0.3)' }}>›</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '200', color: 'rgba(174,239,77,0.55)', lineHeight: 20 }} numberOfLines={2}>{a.intro}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {tab === 'methode' && (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(174,239,77,0.15)', borderRadius: 20, padding: 18, marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '200', color: 'rgba(174,239,77,0.7)', lineHeight: 22 }}>{tr.biblio_intro}</Text>
            </View>
            {fiches.map((f, i) => (
              <TouchableOpacity key={i} onPress={() => setOpenFiche(f)} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,18,32,0.8)', borderWidth: 1.5, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#AEEF4D' }}>{f.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '200', color: '#ffffff' }}>{f.etape}</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{f.soustitre}</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: 'rgba(174,239,77,0.3)' }}>›</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '200', color: 'rgba(174,239,77,0.55)', lineHeight: 20 }} numberOfLines={2}>{f.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export default Biblio;
