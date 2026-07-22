import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CanvasEditor, type EditorMode, type SelectionInfo } from '../editorEngine';
import { SHAPES, renderShapeIcon, type ShapeId } from '../shapes';
import { createChallenge } from '../api';
import { addMyChallenge } from '../myChallenges';

const TIME_OPTIONS = [30, 60, 90, 120];
const COLOR_SWATCHES = ['#8a6d3b', '#4b5563', '#1f2937', '#b45309', '#166534', '#7c2d12', '#f5f5f4', '#0f172a'];

type Step = 'photo' | 'compose' | 'settings' | 'done';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function Editor() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useRef<CanvasEditor | null>(null);

  const [step, setStep] = useState<Step>('photo');
  const [backgroundImg, setBackgroundImg] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 480 });
  const [mode, setMode] = useState<EditorMode>('move');
  const [brushColor, setBrushColor] = useState(COLOR_SWATCHES[0]);
  const [brushSize, setBrushSize] = useState(28);
  const [selection, setSelection] = useState<SelectionInfo>({ id: null, canUndo: false, canRedo: false });
  const [characterCount, setCharacterCount] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState(60);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  // Canvas mounts once a background photo is chosen and stays mounted for the
  // rest of the flow (settings/done render as overlays) so the CanvasEditor
  // instance and its placed characters survive step navigation.
  useEffect(() => {
    if (!backgroundImg || !canvasRef.current) return;
    const editor = new CanvasEditor(canvasRef.current, backgroundImg, canvasSize.width, canvasSize.height);
    editor.onSelectionChange = setSelection;
    editor.onChange = () => setCharacterCount(editor.characterCount);
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [backgroundImg, canvasSize]);

  useEffect(() => {
    editorRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    editorRef.current?.setBrush({ color: brushColor, size: brushSize });
  }, [brushColor, brushSize]);

  async function handleFile(file: File, source: 'gallery' | 'camera') {
    setPhotoError(null);
    if (!file.type.startsWith('image/')) {
      setPhotoError('이미지 파일을 선택해주세요.');
      return;
    }
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(file);
      });
      const img = await loadImage(dataUrl);
      const maxW = Math.min(window.innerWidth - 32, 480);
      const width = maxW;
      const height = Math.min(720, Math.round(maxW * (img.height / img.width)));
      setCanvasSize({ width, height });
      setBackgroundImg(img);
      setStep('compose');
    } catch {
      setPhotoError(source === 'camera' ? '사진 촬영에 실패했어요. 다시 시도해주세요.' : '사진을 불러오지 못했어요. 다시 선택해주세요.');
    }
  }

  function addCharacter(shape: ShapeId) {
    editorRef.current?.addCharacter(shape);
    setMode('move');
  }

  function handleUndo() {
    editorRef.current?.undo();
  }
  function handleRedo() {
    editorRef.current?.redo();
  }
  function handleDelete() {
    editorRef.current?.deleteSelected();
  }

  async function handlePublish() {
    if (!editorRef.current) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const { dataUrl, hitRegions, characterCount: cnt } = editorRef.current.exportComposite();
      if (cnt === 0) {
        setPublishError('캐릭터를 최소 1개 이상 배치해주세요.');
        setPublishing(false);
        setStep('compose');
        return;
      }
      const res = await createChallenge({
        title: title.trim() || '위장 캐릭터 찾기 챌린지',
        compositeImage: dataUrl,
        hitRegions,
        timeLimitSeconds: timeLimit,
      });
      addMyChallenge({
        id: res.id,
        creatorToken: res.creatorToken,
        title: title.trim() || '위장 캐릭터 찾기 챌린지',
        createdAt: new Date().toISOString(),
      });
      const url = `${window.location.origin}/c/${res.id}`;
      setShareUrl(url);
      setStep('done');
    } catch {
      setPublishError('업로드에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setPublishing(false);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: '위장 캐릭터 찾기 챌린지', text: '숨겨진 캐릭터를 찾아보세요!', url: shareUrl });
        return;
      } catch {
        // user cancelled or share failed; fall through to copy
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  if (step === 'photo') {
    return (
      <div className="page center-page">
        <h1>사진으로 챌린지 만들기</h1>
        <p className="muted">배경으로 쓸 사진을 먼저 골라주세요.</p>
        {photoError && <p className="error-text">{photoError}</p>}
        <label className="btn btn-primary">
          갤러리에서 선택
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'gallery')}
          />
        </label>
        <label className="btn btn-secondary">
          사진 촬영
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'camera')}
          />
        </label>
      </div>
    );
  }

  const selected = selection.id !== null;

  return (
    <div className="page editor-page">
      <canvas
        ref={canvasRef}
        className="editor-canvas"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => editorRef.current?.handlePointerDown(e)}
        onPointerMove={(e) => editorRef.current?.handlePointerMove(e)}
        onPointerUp={() => editorRef.current?.handlePointerUp()}
        onPointerLeave={() => editorRef.current?.handlePointerUp()}
      />

      <div className="editor-toolbar">
        <div className="mode-row">
          <button className={`chip ${mode === 'move' ? 'chip-active' : ''}`} onClick={() => setMode('move')}>
            이동/변형
          </button>
          <button className={`chip ${mode === 'paint' ? 'chip-active' : ''}`} onClick={() => setMode('paint')} disabled={!selected}>
            색칠
          </button>
          <button className={`chip ${mode === 'erase' ? 'chip-active' : ''}`} onClick={() => setMode('erase')} disabled={!selected}>
            지우개
          </button>
          <button className={`chip ${mode === 'eyedrop' ? 'chip-active' : ''}`} onClick={() => setMode('eyedrop')} disabled={!selected}>
            스포이트
          </button>
        </div>

        {mode === 'paint' && (
          <div className="brush-row">
            <div className="swatches">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  className={`swatch ${brushColor === c ? 'swatch-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setBrushColor(c)}
                />
              ))}
              <span className="swatch swatch-current" style={{ background: brushColor }} title="현재 색상" />
            </div>
            <label className="slider-label">
              브러시 크기
              <input type="range" min={8} max={60} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
            </label>
          </div>
        )}

        <div className="action-row">
          <button className="icon-btn" onClick={handleUndo} disabled={!selection.canUndo}>
            ↶ 실행취소
          </button>
          <button className="icon-btn" onClick={handleRedo} disabled={!selection.canRedo}>
            ↷ 다시실행
          </button>
          <button className="icon-btn danger" onClick={handleDelete} disabled={!selected}>
            🗑 삭제
          </button>
        </div>

        <div className="palette-row">
          {SHAPES.map((s) => (
            <button key={s.id} className="palette-item" onClick={() => addCharacter(s.id)}>
              <img src={renderShapeIcon(s.id)} alt={s.label} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <button className="btn btn-primary next-btn" onClick={() => setStep('settings')} disabled={characterCount === 0}>
          다음 ({characterCount}개 배치됨)
        </button>
      </div>

      {step === 'settings' && (
        <div className="editor-overlay">
          <div className="page center-page">
            <h1>마지막 설정</h1>
            <label className="field-label">
              챌린지 이름
              <input
                className="text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 우리집 고양이 찾기"
                maxLength={80}
              />
            </label>
            <label className="field-label">
              제한 시간
              <div className="time-options">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    className={`chip ${timeLimit === t ? 'chip-active' : ''}`}
                    onClick={() => setTimeLimit(t)}
                    type="button"
                  >
                    {t}초
                  </button>
                ))}
              </div>
            </label>
            <p className="muted">숨긴 캐릭터: {characterCount}개</p>
            {publishError && <p className="error-text">{publishError}</p>}
            <button className="btn btn-primary" onClick={handlePublish} disabled={publishing}>
              {publishing ? '게시 중...' : '챌린지 게시하기'}
            </button>
            <button className="btn btn-ghost" onClick={() => setStep('compose')} disabled={publishing}>
              편집으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="editor-overlay">
          <div className="page center-page">
            <h1>챌린지 완성!</h1>
            <p className="muted">친구에게 링크를 보내 도전해보세요.</p>
            <div className="share-url-box">{shareUrl}</div>
            <button className="btn btn-primary" onClick={handleShare}>
              {shareCopied ? '링크 복사됨!' : '공유하기'}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/my')}>
              내 챌린지 목록
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              홈으로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
