-- Seed: Standard-Aufgabenliste + Inspektionsliste (idempotent).
-- Ausfuehren NACH schema_saubermachtag.sql:
--   docker exec -i supabase-db psql -U postgres < seed_saubermachtag.sql

do $$ begin
if not exists (select 1 from smt_task_templates) then
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Böden saugen und wischen (inkl. Leisten, Zimmerecken und Spinnweben)','4x',true,true,true,true,'NaWoDos, die am Tag selbst nicht können',0);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Lampen entstauben','',true,false,false,false,null,1);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Heizungen, Lüftungsrohre und -auslässe abwischen','1x',true,false,false,false,null,2);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Gardinenstange wischen  (Stoffe ggf. waschen)','1x',true,false,false,false,null,3);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Abstellräume aufräumen und Oberflächen abwischen','2x',true,false,true,false,null,4);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Sofas und Stühle absaugen,  gelben Bezug waschen','1x',false,false,true,false,null,5);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Teppiche ausklopfen','1x',false,false,true,false,null,6);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('GMW allgemein','Wohnungstür und Innentüren reinigen','1x',false,false,true,false,null,7);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Mülleimer sauber machen','4x',true,true,true,true,null,8);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Geschirrspüler reinigen (Reinigungsspülgang mit Spezialmittel)','2x',true,false,true,false,null,9);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Backofen, Mikrowelle, Kaffeemaschine (inkl. Kannen) reinigen','2x',true,false,true,false,null,10);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Kühlschrank auswischen (Eisfächer abtauen und 2. Kühlschrank checken)','2x',true,false,true,false,null,11);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Schrankfronten abwischen (inkl. Bodenblenden und Fließenspiegel)','2x',true,false,true,false,null,12);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Vorräte inkl. Kühschrank checken und aussortieren','1x',true,false,false,false,null,13);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Regale und Schränke auswischen','1x',false,true,false,false,null,14);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Küche','Dunstabzugshaube reinigen (Fettfilter geeignet für Spülmaschine)','1x',false,false,true,false,null,15);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Büro','Regale auswischen','1x',true,false,false,false,null,16);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Büro','Oberflächen (inkl. Fensterbrett außen) abwischen','1x',true,false,false,false,null,17);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Bad','Dusche reinigen  (inkl. Fließen, Armaturen und Rinne)','2x',true,false,true,false,null,18);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Bad','Waschbeckenabfluss reinigen','2x',true,false,true,false,null,19);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Bad','Regal und Schrank auswischen','1x',true,false,false,false,null,20);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Laubengänge','Unkraut jäten','4x',true,true,true,true,null,21);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Laubengänge','Spinnweben entfernen','2x',false,true,false,true,null,22);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Laubengänge','Briefkästen abwischen','2x',false,true,false,true,null,23);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Laubengänge','Rinnen vor den Haustüren reinigen','1x',false,false,true,false,'Klappt das gut mit einem Industriesauger?',24);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Böden saugen','2x',false,true,false,true,null,25);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Lichtschächte reinigen','2x',false,true,false,true,null,26);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Rinnen an der Abfahrt putzen und freispülen','2x',false,true,false,true,null,27);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Lampen entstauben','1x',false,true,false,false,null,28);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Elektroraum checken','1x',false,true,false,false,null,29);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Getränkekellerregal auswischen','1x',false,true,false,false,null,30);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Raum unter Gargeneinfahrt aufräumen','1x',false,false,false,true,null,31);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Kellerraum 24 aufräumen','1x',false,false,false,true,null,32);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Keller/Tiefgarage','Optional: MFR aufräumen','???',true,true,true,true,null,33);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Schuppen','Schuppenraum aufräumen und reinigen','2x',false,true,false,true,null,34);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Schuppen','Veranda aufräumen und reinigen','2x',false,true,false,true,null,35);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Schuppen','Gartenstühle reinigen','1x',false,true,false,false,null,36);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Schuppen','Im Herbst: Akkus im Keller einlagern, Pumpe heben und reinigen,  Holzstühle auf Veranda unterstellen','1x',false,false,false,true,null,37);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Schuppen','Schuppendach von Unkraut befreien','2x',false,true,false,true,null,38);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Hausdächer','Von Unkraut befreien','2x',false,true,false,true,null,39);
  insert into smt_task_templates (bereich,title,haeufigkeit,slot1,slot2,slot3,slot4,kommentar,sort_order) values ('Hausdächer','Regenrinnen kontrollieren und säubern','2x',false,true,false,true,null,40);
end if;
end $$;

do $$ begin
if not exists (select 1 from smt_inspection) then
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('d3d905ba-c118-43fe-a2f1-94b677053954','Dach','2022: Dachleiste defekt
2024: Dach wurde nicht begangen, wird wohl Status idem oder schlimmer geworden sein
2025: Status idem',null,1);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('d3d905ba-c118-43fe-a2f1-94b677053954','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/1/insp_01_1.jpg','insp_01_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('93087f6e-1095-499c-84d2-0d5b2981cad5','Dach','2022: Kettensicherung der Photovoltaikanlage nicht korrekt
2024: Status idem
2025: Status idem
(Es fehlt ein Kopf obendrauf, der verhindert, dass die Sicherungskette der Photovoltaikanlage drüber rutscht)','Evd informieren – Chris – Evd ist informiert',2);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('93087f6e-1095-499c-84d2-0d5b2981cad5','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/2/insp_02_1.jpg','insp_02_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('ba243052-7bc8-4d3e-822f-c5145bdd1c1e','Dach','2022: Drahtseil zum Sichern auf unserem Dach fehlt
2024: Status idem
2025: Status idem
(beim Hausdach des gegenüberliegenden Mehrfamilienhauses vorhanden, Ösen sind vorhanden)','Drahtseil besorgen & durch Ösen fädeln – Angi recherchiert nochmal',3);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('ba243052-7bc8-4d3e-822f-c5145bdd1c1e','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/3/insp_03_1.jpg','insp_03_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('041b04d2-6e43-431e-bd1d-dd077a6f241b','Dach','2022: Solarpanelen/PV und Solarthermie-Panels zeigen Bewuchs und Verschmutzung
2024: Status idem
Anmerkung: nicht unsere Aufgabe, da Anlage an evd verpachtet; NaWoDo kann nur anbieten, diese Aufgabe zu übernehmen
2025: Status idem','Säuberung sinnvoll, Leistung der Anlage sinkt sonst, mit evd abzustimmen – Chris – Evd ist informiert',4);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('041b04d2-6e43-431e-bd1d-dd077a6f241b','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/4/insp_04_1.jpg','insp_04_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('041b04d2-6e43-431e-bd1d-dd077a6f241b','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/4/insp_04_2.jpg','insp_04_2.jpg',1);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('3d821fc1-3b24-4a40-893a-00aae8398d36','Dach','2022: Solarthermie-Panels: eine Folie ist leicht defekt
2024: Status idem
Anmerkung: nicht unsere Aufgabe, da Anlage an evd verpachtet
2025: Status idem
(aus einem Panel der Solarthermie tropft Flüssigkeit, ein Eimer wurde darunter gestellt)','Säuberung sinnvoll, mit evd abzustimmen – Chris – Evd ist informiert. Auslaufen aus Panel an evd melden',5);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('3d821fc1-3b24-4a40-893a-00aae8398d36','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/5/insp_05_1.jpg','insp_05_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('6f346ff1-e04d-45b7-8839-56c458c56b16','Dach','2022: Stein auf dem Schornstein wackelig
2024: Status idem
2025: Status idem',null,6);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('6f346ff1-e04d-45b7-8839-56c458c56b16','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/6/insp_06_1.jpg','insp_06_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('ef17e5f0-3354-4895-8a79-8053ac516ebc','Außen','2023: Rinnengitter vor WE23 zu kurz
2024: Status idem
2025: Status idem','Neues Rinnengitter steht neben Haustür, Lars kümmert sich',7);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('ef17e5f0-3354-4895-8a79-8053ac516ebc','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/7/insp_07_1.jpg','insp_07_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('020ac110-d491-4c69-8e13-609c07f1e5eb','Treppenhaus außen','2022: Nachträgliche Abdichtung an den Übergängen
2024: Status idem
2025: Status idem, aktuell wieder von Dachdecker in Bearbeitung
(… werden immer problematisch sein)',null,8);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('020ac110-d491-4c69-8e13-609c07f1e5eb','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/8/insp_08_1.jpg','insp_08_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('5c4be20e-dbb2-4b83-9595-ba6ebe9d6cdc','Fassade','Unter & an Fensterbänken der WE 16 & 17 bilden sich Insektennester','Frage: was sind das für Tiere?',9);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('5c4be20e-dbb2-4b83-9595-ba6ebe9d6cdc','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/9/insp_09_1.jpg','insp_09_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('5c4be20e-dbb2-4b83-9595-ba6ebe9d6cdc','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/9/insp_09_2.jpg','insp_09_2.jpg',1);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('58641821-35ae-4ac9-8da6-19afeffb33ed','Fassade','2023: Armiereisen zeigen Rost, hier bei WE 14/15
2024: Status idem
2025: Status idem','Weiterhin beobachten, kein Handlungsbedarf',10);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('58641821-35ae-4ac9-8da6-19afeffb33ed','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/10/insp_10_1.jpg','insp_10_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('d13b3747-8ceb-400b-8b2b-5d6b76d044ec','Fassade','2024: Pilz an Putz an verschiedenen Stellen, im Foto bei WE9
2025: Status idem','Aljoscha beobachtet, wächst nicht weiter',11);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('d13b3747-8ceb-400b-8b2b-5d6b76d044ec','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/11/insp_11_1.jpg','insp_11_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('50bdaaf7-0f30-4eec-8b4d-c297ac38687e','Fassade','Fallrohr vor WE 9 locker, da Schraube in Putz verankert, dort keinen großen Halt. Ist vermutlich durch regen Kinderverkehr an der prominenten Stelle',null,12);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('50bdaaf7-0f30-4eec-8b4d-c297ac38687e','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/12/insp_12_1.jpg','insp_12_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('62f1f447-dfce-43a4-b1ac-a728cb517ce3','Fassade','2022: Übergang Wand/Decke, nachträgliche Verputzung Höhe WE10/11 bröckelt
2024: Status idem
2025: Status idem',null,13);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('62f1f447-dfce-43a4-b1ac-a728cb517ce3','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/13/insp_13_1.jpg','insp_13_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('df0f3ae7-ec62-49b2-8571-595bd53e912b','Fassade','2022: Übergang Putz zur Verlattung 1. Etage / Aufzug unsauber gemacht
2024: Status idem
2025: Status idem','Dachdecker beauftragen?',14);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('df0f3ae7-ec62-49b2-8571-595bd53e912b','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/14/insp_14_1.jpg','insp_14_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('59251944-5e5b-4215-8259-4199b8d3e325','Treppenhaus außen','2022: Aussenstromkabel 1. Etage liegt frei
2024: Status idem
2025: Status idem','Dose auf Kabel drauf setzen?',15);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('59251944-5e5b-4215-8259-4199b8d3e325','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/15/insp_15_1.jpg','insp_15_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('59251944-5e5b-4215-8259-4199b8d3e325','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/15/insp_15_2.jpg','insp_15_2.jpg',1);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('a6f960ae-2bea-49a3-9963-82b1aca72a3c','Außen','2022: Füße/Stütze der Wendeltreppen schweben frei (alle)
2024: Wendeltreppe Ost Mörtel in Loch, dadurch leiser; Wendeltreppe West schwebt weiterhin in der Luft, dadurch sehr laut
2025: Ost mit Mörtel verfüllt, West mit Sand, keine lauten Schwingungen wahrnehmbar','Weiter Beobachtung in 2026',16);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('a6f960ae-2bea-49a3-9963-82b1aca72a3c','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/16/insp_16_1.jpg','insp_16_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('7f7b9f1c-03db-4bc1-92ba-3ac3275b7c3c','Fassade','2024: vor WE6 dunklere Flecken an unterer Fassade
2025: war mal weg lt Johannes, nun wieder da & größer geworden, siehe Foto (oben 2024, unten 2025)','Dachdecker befragen – Christiane',17);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('7f7b9f1c-03db-4bc1-92ba-3ac3275b7c3c','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/17/insp_17_1.jpg','insp_17_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('7f7b9f1c-03db-4bc1-92ba-3ac3275b7c3c','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/17/insp_17_2.jpg','insp_17_2.jpg',1);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('7df7fb09-1ee5-46fd-b968-a6acddca5cfb','Fassade','2022: Größere Rillen im Beton, wo man die Dämmwolle sehen kann
2024: Status idem
2025: Status idem','Zuspachteln, wenn das TH renoviert wird, kein akuter Handlungsbedarf',18);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('7df7fb09-1ee5-46fd-b968-a6acddca5cfb','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/18/insp_18_1.jpg','insp_18_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('d3471dae-d189-4d7c-b4a6-e64ff5ab4ae0','Außen','2022: verschiedene Fehlbohrungen, auch im EG
2024: Status idem, zusätzlich kl Löcher, die für Stromführung gedacht waren, aufgefallen; Farbe fängt in EG bei WE 5 an Spachtelstelle an zu bröckeln
2025: Status idem','Gr Löcher: Kappen in Bezug Treppenhaus streichen einfügen; Kl Löcher: in Bezug Treppenhaus streichen zuspachteln',19);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('d3471dae-d189-4d7c-b4a6-e64ff5ab4ae0','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/19/insp_19_1.jpg','insp_19_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('d3471dae-d189-4d7c-b4a6-e64ff5ab4ae0','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/19/insp_19_2.jpg','insp_19_2.jpg',1);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('e57d43ca-3c2a-499f-b993-88c32be50914','Treppenhaus außen','2022: Schmutzrinnen EG, Ablagerungen an der Wand 1. Etage
2024: Status idem
2025: Status idem','Im Zuge Treppenhaus streichen zu beseitigen; abfließendes Wasser wird aufgrund Bau des TH immer an diesen Stellen herunterlaufen',20);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('e57d43ca-3c2a-499f-b993-88c32be50914','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/20/insp_20_1.jpg','insp_20_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('e57d43ca-3c2a-499f-b993-88c32be50914','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/20/insp_20_2.jpg','insp_20_2.jpg',1);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('640148ea-c90a-4d95-9a74-55f3239b8a9a','Treppenhaus außen','2024: an der Kellertür ist weiterhin keine Schutzkappe am Drehschloss -> Verletzungsgefahr
2025: Status idem',null,21);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('640148ea-c90a-4d95-9a74-55f3239b8a9a','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/21/insp_21_1.jpg','insp_21_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('6326354a-543c-4523-b6e6-37c647f91b47','Treppenhaus außen','2022: Beschädigung durch die Lenker der Roller
2024: Status idem
2025: Status idem','Im Zuge Treppenhaus streichen zu beheben',22);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('6326354a-543c-4523-b6e6-37c647f91b47','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/22/insp_22_1.jpg','insp_22_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('a265f697-037a-44dc-bee9-cd83ee57197a','Fassade','2022: Schäden am Außenputz
2025: Status idem
(diverse Schäden, der größte in der Nähe der Tür von WE02; ansonsten hin und wieder kleinere, wie im dritten Bild)','Aktuell nicht zu ändern, keine Aktion notwendig',23);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('a265f697-037a-44dc-bee9-cd83ee57197a','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/23/insp_23_1.jpg','insp_23_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('a265f697-037a-44dc-bee9-cd83ee57197a','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/23/insp_23_2.jpg','insp_23_2.jpg',1);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('a265f697-037a-44dc-bee9-cd83ee57197a','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/23/insp_23_3.jpg','insp_23_3.jpg',2);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('3085394d-833d-4cc7-b33f-aff7249798f3','TG-Rampe oben','2023: Kabel TG-Einfahrt gekürzt und versteckt, Abschlussdeckel fehlt
2024: Status idem
2025: Status idem',null,24);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('3085394d-833d-4cc7-b33f-aff7249798f3','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/24/insp_24_1.jpg','insp_24_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('92552e1d-76df-4a4c-b894-ab6bb988f7b5','TG-Rampe oben','2023: Abdeckung Schlüsselsäulen-Verteiler
2024: Status idem
2025: Schlauch als Leerrohr verwendet, Ziegel verschließen Loch, damit ggf Service an Kabel gemacht werden kann',null,25);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('92552e1d-76df-4a4c-b894-ab6bb988f7b5','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/25/insp_25_1.jpg','insp_25_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('161407bf-88ca-4c11-93d6-2cdf6c7ae305','TG Parkplatz WE 19','Plastik an Lichtschacht defekt, da dort vermutlich GaLa-Bauer mit Bagger drüber gefahren','Weiter beobachten',26);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('161407bf-88ca-4c11-93d6-2cdf6c7ae305','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/26/insp_26_1.jpg','insp_26_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('6984e2fd-2013-47e2-b900-78cca1cbda2c','Keller','2024: runder Kasten von Schleuse zu Treppenhaus ist nicht an Wand angebracht & leuchtet nicht
2025: Status idem','Wofür ist das? Elektriker fragen – Christiane – Elektriker befragt (5.2.)',27);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('6984e2fd-2013-47e2-b900-78cca1cbda2c','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/27/insp_27_1.jpg','insp_27_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('ee080b7c-8101-456b-aa4f-f2b4b0cd856e','Heizungskeller','2022: Ein Hahn abgebrochen
2024: Status idem
2025: Status idem','Anlage ist von Solvis',28);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('ee080b7c-8101-456b-aa4f-f2b4b0cd856e','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/28/insp_28_1.jpg','insp_28_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('05a1167b-d62d-42b8-9a6b-53f43fadf74d','Heizungskeller','2022: Beschriftungen mit Kreppband lösen sich
2024: Status idem
2025: Status idem','Anlage ist von Solvis',29);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('05a1167b-d62d-42b8-9a6b-53f43fadf74d','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/29/insp_29_1.jpg','insp_29_1.jpg',0);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('f172e32f-00be-4606-91ec-80ffba246adc','Keller','2025: Lichtschacht von Keller WE6 ist Plastik, ca. 10cm Abstand zur Wand, ist mit Erde aufgefüllt',null,30);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('f172e32f-00be-4606-91ec-80ffba246adc','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/30/insp_30_1.jpg','insp_30_1.jpg',0);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('f172e32f-00be-4606-91ec-80ffba246adc','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/30/insp_30_2.jpg','insp_30_2.jpg',1);
  insert into smt_inspection (id,bereich,beschreibung,stand,sort_order) values ('65e16210-1734-485d-8308-19654f228351','Rondell','2023: Steine im Rondell lose
2024: nur noch li Seite lose
2025: Status idem',null,31);
  insert into smt_inspection_photos (inspection_id,url,filename,sort_order) values ('65e16210-1734-485d-8308-19654f228351','https://api.nawodo.de/storage/v1/object/public/saubermachtag-media/inspektion/31/insp_31_1.jpg','insp_31_1.jpg',0);
end if;
end $$;
