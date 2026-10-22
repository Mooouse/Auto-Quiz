import type {GameContext} from '@gp/core';
import {useFont} from '@gp/art/type';
import {EXO_2} from '@gp/art/type/exo-2';
import {AutoQuizApp} from './ui/app.ts';
import './ui/styles.css';
import './ui/racing.css';
export default async function start(context:GameContext){useFont(EXO_2);const app=new AutoQuizApp(context);await app.start();}

import './ui/circuit.css';
