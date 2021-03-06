/**
 * @version todo
 * @misha to review
 */
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { View, TouchableWithoutFeedback, Keyboard, Platform, Linking } from 'react-native'

import ImagePicker from 'react-native-image-picker'
import AsyncStorage from '@react-native-community/async-storage'
import { check, request, PERMISSIONS } from 'react-native-permissions'
import Carousel, { Pagination } from 'react-native-snap-carousel'

import i18n, { strings } from '../../../services/i18n'

import { hideModal, showModal } from '../../../appstores/Stores/Modal/ModalActions'
import { setLoaderStatus } from '../../../appstores/Stores/Main/MainStoreActions'
import { deleteCard, setCards } from '../../../appstores/Stores/Card/CardActions'

import NavStore from '../../../components/navigation/NavStore'

import Templates from './templates'
import Log from '../../../services/Log/Log'

import Api from '../../../services/Api/Api'
import cardDS from '../../../appstores/DataSource/Card/Card'
import utils from '../../../services/utils'
import FileSystem from '../../../services/FileSystem/FileSystem'

class Cards extends Component {

    constructor(props) {
        super(props)
        this.state = {
            showCards: false,
            cards: [],
            firstItem: 0,
            imagePickerOptions: {
                title: 'Select Avatar',
                customButtons: [{ name: '', title: '' }]
                // storageOptions: {
                //     cameraRoll: true
                // },
            },
            isPhotoValidation: false,
            photoValidationCurrencies: ['RUB'],

            enabled: true
        }
    }

    init = () => {
        let cards = JSON.parse(JSON.stringify(this.props.cardStore.cards))

        console.log(this.props.cardStore.cards)

        cards = cards.map(item => {
            return { ...item, supported: true }
        })

        this.setState({
            cards,
            firstItem: cards.length - 1
        })

        this.props.handleSetState('selectedCard', cards[cards.length - 1])
    }

    getState = () => this.state

    initFromProps = (cards, isNewAdded) => {
        try {
            cards = cards.map(item => {
                return { ...item, supported: true }
            })

            if (isNewAdded) {
                this.setState({
                    cards,
                    firstItem: cards.length - 1
                })

                this.props.handleSetState('selectedCard', cards[cards.length - 1])
            } else {

                let updateSelectedCard = JSON.parse(JSON.stringify(cards))
                updateSelectedCard = updateSelectedCard.filter(item => item.id === this.props.selectedCard.id)

                const selectedCardIndex = cards.findIndex(item => item.id === this.props.selectedCard.id)

                this.setState({
                    cards,
                    firstItem: selectedCardIndex
                })

                this.props.handleSetState('selectedCard', updateSelectedCard[0])
            }
        } catch (e) {
            Log.err('Cards.initFromProps error ' + e)
        }
    }

    drop = () => {
        this.setState({
            showCards: false,
            cards: []
        })
    }

    UNSAFE_componentWillMount() {
        this.init()
    }

    componentDidMount() {
        this.setState({
            showCards: true
        })
    }

    disableCards = () => {
        this.setState({ enabled: false })
        return this
    }

    enableCards = () => {
        this.setState({ enabled: true })
        return this
    }

    enableCardValidation = () => {
        this.setState({ isPhotoValidation: true })
        return this
    }

    disableCardValidation = () => {
        this.setState({ isPhotoValidation: false })
        return this
    }

    refresh = () => {
        this.setState({
            showCards: false
        }, () => {
            this.setState({
                showCards: true
            })
        })
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        try {
            const tradeApiConfig = JSON.parse(JSON.stringify(this.props.exchangeStore.tradeApiConfig))
            const { selectedCryptocurrency, extendsFields } = this.props
            const { selectedPaymentSystem, selectedCard } = nextProps

            let exchangeWayForCountries = tradeApiConfig.exchangeWays.filter(
                item =>
                    item[extendsFields.fieldForFiatCurrency] === selectedPaymentSystem.currencyCode &&
                    item[extendsFields.fieldForPaywayCode] === selectedPaymentSystem.paymentSystem &&
                    item[extendsFields.fieldForCryptocurrency] === selectedCryptocurrency.currencyCode
            )

            if (exchangeWayForCountries.length) {
                this.handleFilterCards(exchangeWayForCountries[0].supportedCountries, selectedCard)

                if (nextProps.cardStore.cards.length !== this.props.cardStore.cards.length) {
                    this.setState({
                        showCards: false,
                        cards: nextProps.cardStore.cards
                    }, () => {
                        this.handleFilterCards(exchangeWayForCountries[0].supportedCountries, nextProps.cardStore.cards[nextProps.cardStore.cards.length - 1])
                    })
                }
            }

            if (!utils.isArrayEqual(nextProps.cardStore.cards, this.props.cardStore.cards)) {

                const isNewAdded = nextProps.cardStore.cards.length !== this.props.cardStore.cards.length

                this.setState({
                    showCards: false,
                    cards: nextProps.cardStore.cards
                }, () => {
                    this.initFromProps(nextProps.cardStore.cards, isNewAdded)
                    setTimeout(() => {
                        this.setState({
                            showCards: true
                        })
                    }, 200)
                })
            }

        } catch (e) {
            Log.err('Cards.UNSAFE_componentWillReceiveProps error ' + e)
        }
    }

    handleFilterCards = (supportedCountries, selectedCard) => {
        let cards = JSON.parse(JSON.stringify(this.state.cards))
        let cardsTmp = []
        const { tradeType } = this.props.exchangeStore

        cards.forEach(item1 => {
            let finded = false

            supportedCountries.forEach(item2 => {

                // TODO: remove support cards for kazakhstan (#RESHENIE)

                if (item1.countryCode === item2.toString() || (tradeType === 'BUY' && this.props.selectedPaymentSystem.currencyCode === 'RUB' && (item1.countryCode === '398' || item1.countryCode === '112'))) finded = true
            })

            if (finded) {
                cardsTmp.push({ ...item1, supported: true })
            } else {
                cardsTmp.push({ ...item1, supported: false })
            }
        })

        if (tradeType === 'SELL') {
            //TODO: fix this sort buy native currency and custom
        }

        this.setState({
            showCards: true,
            cards: cardsTmp
        })

        let updateSelectedCard = JSON.parse(JSON.stringify(cardsTmp))

        updateSelectedCard = updateSelectedCard.filter(item => item.id === selectedCard.id)

        this.props.self.state.selectedCard = updateSelectedCard[0]
    }

    handleAddCard = () => NavStore.goNext('AddCardScreen')

    handleDeleteCard = (card) => {

        const title = strings('modal.infoDeleteCard.title')
        const description = strings('modal.infoDeleteCard.description')
        const { id: cardID } = card

        showModal({
            type: 'CHOOSE_INFO_MODAL',
            data: {
                title,
                description,
                declineCallback: () => hideModal(),
                acceptCallback: async () => {
                    await deleteCard(cardID)
                    hideModal()
                }
            }
        })
    }

    handleOnSnapToItem = (index) => {

        const { cards } = this.state

        this.props.handleSetState('selectedCard', cards[index])
    }

    handleRenderCard = ({ item }) => {
        if (item.type === 'ADD') {
            return <Templates.addCardTemplate card={item} photoValidationCurrencies={this.state.photoValidationCurrencies} isPhotoValidation={this.state.isPhotoValidation} handleAddCard={this.handleAddCard}/>
        } else {
            return <Templates.mainCardTemplate card={item} photoValidationCurrencies={this.state.photoValidationCurrencies} isPhotoValidation={this.state.isPhotoValidation} handleDeleteCard={this.handleDeleteCard} validateCard={this.validateCard}/>
        }
    }

    prepareImageUrl = (response) => {
        try {
            if (typeof response.didCancel !== 'undefined' && response.didCancel) {
                setLoaderStatus(false)
            }

            let path = response.uri

            if (typeof response.uri == 'undefined')
                return

            if (Platform.OS === 'ios') {
                path = path.substring(path.indexOf('/Documents'))
            }

            if (response.didCancel) {
                console.log('User cancelled image picker')
            } else if (response.error) {
                console.log('ImagePicker Error: ', response.error)
            } else {
                this.validateCard(path)
            }
        } catch (e) {
            Log.err('Cards.prepareImageUrl error ' + e)
        }
    }

    validateCard = async (photoSource) => {
        try {
            const deviceToken = await AsyncStorage.getItem('fcmToken')
            const locale = i18n.locale.split('-')[0]

            const { cards } = this.state
            const { selectedCard } = this.props
            const { imagePickerOptions } = this.state
            const data = new FormData()

            const tmpCards = JSON.parse(JSON.stringify(cards))
            const selectedCardIndex = cards.findIndex(item => item.id === selectedCard.id)

            data.append('cardNumber', tmpCards[selectedCardIndex].number)

            if(typeof photoSource !== 'undefined') {
                const fs = new FileSystem()
                const base64 = await fs.handleImageBase64(photoSource)
                data.append('image', 'data:image/jpeg;base64,' + base64)
            }

            typeof deviceToken !== 'undefined' && deviceToken !== null ?
                data.append('deviceToken', deviceToken) : null

            typeof locale !== 'undefined' && locale !== null ?
                data.append('locale', locale) : null

            this.setState({
                cards: tmpCards,
                firstItem: selectedCardIndex
            }, async () => {

                try {

                    let res = await Api.validateCard(data)
                        res = await res.json()

                    // @misha to optimize
                    if ((typeof res.message !== 'undefined' && res.message.includes('Card has not been verified')) || (typeof res.errorMsg !== 'undefined' && res.errorMsg.includes('No file was uploaded'))) {
                        this.setState({
                            cards: tmpCards,
                            firstItem: selectedCardIndex
                        })

                        if (Platform.OS === 'ios') {
                            const res = await check(PERMISSIONS.IOS.CAMERA)

                            if (res === 'blocked') {
                                showModal({
                                    type: 'OPEN_SETTINGS_MODAL',
                                    icon: false,
                                    title: strings('modal.openSettingsModal.title'),
                                    description: strings('modal.openSettingsModal.description'),
                                    btnSubmitText: strings('modal.openSettingsModal.btnSubmitText')
                                }, () => {
                                    Linking.openURL('app-settings:')
                                })
                                return
                            }
                        }

                        request(
                            Platform.select({
                                android: PERMISSIONS.ANDROID.CAMERA,
                                ios: PERMISSIONS.IOS.CAMERA
                            })
                        ).then((res) => {
                            setLoaderStatus(true)
                            ImagePicker.launchCamera(imagePickerOptions, (response) => {
                                if (typeof response.error === 'undefined') {
                                    this.prepareImageUrl(response)
                                } else {
                                    setLoaderStatus(false)
                                }
                            })
                        })
                    } else if (res.verificationStatus === 'pending') {
                        await cardDS.updateCard({
                            key: {
                                id: tmpCards[selectedCardIndex].id
                            },
                            updateObj: {
                                cardVerificationJson: JSON.stringify(res)
                            }
                        })
                        await setCards()

                        showModal({
                            type: 'INFO_MODAL',
                            icon: 'INFO',
                            title: strings('modal.pleaseWaitModal.title'),
                            description: strings('modal.pleaseWaitModal.description')
                        })

                        setLoaderStatus(false)
                    }
                    else if (res.verificationStatus === 'success') {
                        await cardDS.updateCard({
                            key: {
                                id: tmpCards[selectedCardIndex].id
                            },
                            updateObj: {
                                cardVerificationJson: JSON.stringify(res)
                            }
                        })
                        await setCards()

                        setLoaderStatus(false)
                    }
                } catch (e) {
                    if (Log.isNetworkError(e.message)) {
                        Log.log('Cards.validateCard error ' + e.message)
                    } else {
                        Log.err('Cards.validateCard 21 error ' + e.message)
                    }
                }
                setLoaderStatus(false)
            })
        } catch (e) {
            if (Log.isNetworkError(e.message)) {
                Log.log('Cards.validateCard error 11 error ' + e.message)
            } else {
                Log.err('Cards.validateCard error 11 error ' + e.message)
            }
        }
    }

    validate = () => {

        const { isPhotoValidation } = this.state
        const { selectedCard } = this.props.self.state

        if (typeof selectedCard.number === 'undefined' || !selectedCard.supported) {
            throw new Error(strings('tradeScreen.modalError.selectCard'))
        }

        const selectedCardStatus = JSON.parse(selectedCard.cardVerificationJson)

        if (isPhotoValidation) {
            if (selectedCardStatus == null && isPhotoValidation) {
                throw new Error(strings('tradeScreen.modalError.takePhoto'))
            } else if (selectedCardStatus.verificationStatus === 'pending') {
                throw new Error(strings('tradeScreen.modalError.waitValidation'))
            } else if (selectedCardStatus.verificationStatus === 'canceled') {
                throw new Error(strings('tradeScreen.modalError.canceledValidation'))
            }

            this.props.self.state.uniqueParams = { ...this.props.self.state.uniqueParams, firstName: selectedCardStatus.firstName, lastName: selectedCardStatus.lastName }
            return
        }
        delete this.props.self.state.uniqueParams.firstName
        delete this.props.self.state.uniqueParams.lastName
        delete this.props.self.state.uniqueParams.cardNumber
        this.props.self.state.uniqueParams = { ...this.props.self.state.uniqueParams }
    }

    render() {

        const { cards, enabled, showCards } = this.state
        const { selectedCard } = this.props

        const selectedCardIndex = cards.findIndex(item => item.id === selectedCard.id)

        return (
            <View style={{ width: '100%', maxHeight: !enabled ? 0 : 500, overflow: !enabled ? 'hidden' : 'visible' }}>
                {
                    showCards ?
                        <View style={styles.content}>
                            <View style={styles.content__row}>
                                <View style={[styles.content__item]}>
                                    <TouchableWithoutFeedback style={[styles.content__item]} onPress={Keyboard.dismiss}>
                                        <View style={[styles.content__item]}/>
                                    </TouchableWithoutFeedback>
                                </View>
                                <View>
                                    <Carousel
                                        ref={(c) => {
                                            this._carousel = c
                                        }}
                                        data={cards}
                                        extraData={this.state}
                                        enableMomentum={true}
                                        renderItem={(data) => this.handleRenderCard(data)}
                                        sliderWidth={300}
                                        itemWidth={225}
                                        layout={'stack'}
                                        firstItem={this.state.firstItem}
                                        onSnapToItem={(index) => this.handleOnSnapToItem(index)}
                                    />
                                </View>
                                <View style={[styles.content__item]}>
                                    <TouchableWithoutFeedback style={[styles.content__item]} onPress={Keyboard.dismiss}>
                                        <View style={[styles.content__item]}/>
                                    </TouchableWithoutFeedback>
                                </View>
                            </View>
                            <Pagination
                                dotsLength={cards.length}
                                activeDotIndex={selectedCardIndex}
                                containerStyle={styles.paginationContainer}
                                dotColor={'#864dd9'}
                                dotStyle={styles.paginationDot}
                                inactiveDotColor={'#000'}
                                inactiveDotOpacity={0.4}
                                inactiveDotScale={0.6}
                                carouselRef={this._carousel}
                                tappableDots={!!this._carousel}/>
                        </View> : null
                }
            </View>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        mainStore: state.mainStore,
        exchangeStore: state.exchangeStore,
        cardStore: state.cardStore
    }
}

const mapDispatchToProps = (dispatch) => {
    return {
        dispatch
    }
}

export default connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(Cards)

const styles = {
    content: {
        justifyContent: 'center',
        alignItems: 'center',

        width: '100%'
    },
    content__row: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    content__item: {
        flex: 1,
        alignSelf: 'stretch'
    },
    paginationContainer: {
        marginTop: -30
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        paddingHorizontal: 4
    }
}
